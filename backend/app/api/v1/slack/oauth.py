"""
Slack OAuth integration routes.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.db.session import AsyncSessionLocal, get_async_db
from app.models.slack import SlackWorkspace
from app.services.slack.workspace import WorkspaceService

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["slack"])


class SlackOAuthResponse(BaseModel):
    """Model for Slack OAuth response."""

    ok: bool
    app_id: str = Field(..., alias="app_id")
    authed_user: Dict = Field(...)
    scope: str
    token_type: str
    access_token: str
    bot_user_id: str
    team: Dict
    enterprise: Optional[Dict] = None
    is_enterprise_install: bool = False

    @validator("team")
    def extract_team_info(cls, v):
        """Validate and extract team information."""
        if not v.get("id") or not v.get("name"):
            raise ValueError("Team ID and name are required")
        return v


@router.get("/oauth-url")
async def get_oauth_url(
    client_id: Optional[str] = Query(None),
    client_secret: Optional[str] = Query(None),
    # No longer accepting redirect_uri from frontend
) -> Dict[str, str]:
    """
    Generate OAuth URL for Slack.

    Args:
        client_id: Optional Slack client ID provided by frontend. If not provided, uses env settings.
        client_secret: Optional Slack client secret provided by frontend. If not provided, uses env settings.

    Returns:
        Dictionary containing the OAuth URL.
    """
    # Client ID must be provided by the user through the UI
    if not client_id:
        logger.error("Slack client ID not provided")
        raise HTTPException(status_code=400, detail="Slack client ID is required")
    actual_client_id = client_id

    # Define OAuth scopes needed for the application
    scopes = [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "reactions:read",
        "users:read",
        "users.profile:read",
        "team:read",
    ]

    # Create the OAuth URL
    params = {
        "client_id": actual_client_id,
        "scope": ",".join(scopes),
        "user_scope": "",  # No user tokens needed for our use case
    }

    # Always use our controlled URLs for the callback to ensure it matches the Slack app settings

    # Get base URL from settings.FRONTEND_URL (which should be the ngrok app URL if provided)
    # or construct it from API_URL
    if settings.FRONTEND_URL:
        # Use the FRONTEND_URL directly if it's configured
        frontend_base_url = str(settings.FRONTEND_URL).rstrip("/")
        frontend_callback = f"{frontend_base_url}/auth/slack/callback"
        logger.info(f"Using frontend URL directly: {frontend_base_url}")
    elif settings.API_URL:
        # Extract the base domain from API_URL
        api_url = str(settings.API_URL).rstrip("/")

        # For ngrok or other external URLs, use the frontend domain
        # For example, if API_URL is https://example.ngrok-free.app/api/v1
        # we want to redirect to https://example.ngrok-free.app/auth/slack/callback

        # Remove any path components to get the base domain
        if "/api/v1" in api_url:
            base_url = api_url.split("/api/v1")[0]
        else:
            base_url = api_url

        frontend_callback = f"{base_url}/auth/slack/callback"
        logger.info(f"Extracted base URL from API_URL: {base_url}")
    else:
        # Default for local development - use frontend URL
        frontend_callback = "http://localhost:5173/auth/slack/callback"
        logger.info("Using default local frontend URL")

    params["redirect_uri"] = frontend_callback

    # Log debugging information
    logger.info(f"Settings API_URL: {settings.API_URL}")
    # Only log base_url if we're using API_URL path (not frontend_url or default)
    if not settings.FRONTEND_URL and settings.API_URL:
        logger.info(f"Using base URL: {base_url}")
    logger.info(f"Using redirect URI: {params['redirect_uri']}")

    oauth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"

    return {"url": oauth_url}


async def _exchange_code_for_token(
    code: str, client_id: Optional[str] = None, client_secret: Optional[str] = None
) -> Dict[str, Any]:
    """
    Exchange OAuth code for an access token.

    Args:
        code: Authorization code from Slack
        client_id: Optional client_id to use instead of environment variable
        client_secret: Optional client_secret to use instead of environment variable

    Returns:
        Parsed token response data

    Raises:
        HTTPException: If the request fails or returns an error
    """
    # Client ID must be provided by the user through the UI
    if not client_id:
        logger.error("Slack client ID not provided")
        raise HTTPException(status_code=400, detail="Slack client ID is required")
    actual_client_id = client_id

    # Client secret must be provided by the user through the UI
    if not client_secret:
        logger.error("Slack client secret not provided")
        raise HTTPException(status_code=400, detail="Slack client secret is required")
    actual_client_secret = client_secret

    try:
        # Need to include the same redirect_uri as in the original authorization request

        # Get base URL from settings.FRONTEND_URL or API_URL
        if settings.FRONTEND_URL:
            frontend_base_url = str(settings.FRONTEND_URL).rstrip("/")
            frontend_callback = f"{frontend_base_url}/auth/slack/callback"
        elif settings.API_URL:
            api_url = str(settings.API_URL).rstrip("/")
            if "/api/v1" in api_url:
                base_url = api_url.split("/api/v1")[0]
            else:
                base_url = api_url
            frontend_callback = f"{base_url}/auth/slack/callback"
        else:
            frontend_callback = "http://localhost:5173/auth/slack/callback"

        # Exchange the temporary code for an access token
        token_response = requests.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": actual_client_id,
                "client_secret": actual_client_secret,
                "code": code,
                "redirect_uri": frontend_callback,
            },
        )
        token_response.raise_for_status()

        # Parse the token response
        token_data = token_response.json()

        if not token_data.get("ok"):
            _handle_oauth_error(token_data)

        return token_data

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during Slack OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail="Error connecting to Slack API")


def _handle_oauth_error(token_data: Dict[str, Any]) -> None:
    """
    Handle common OAuth errors with user-friendly messages.

    Args:
        token_data: Error response from Slack API

    Raises:
        HTTPException: With appropriate status code and message
    """
    error_code = token_data.get("error")
    error_message = token_data.get("error_description", "Unknown error")
    logger.error(f"Slack API error: {error_code} - {error_message}")

    # Handle common Slack OAuth errors with user-friendly messages
    if error_code == "invalid_code":
        raise HTTPException(
            status_code=400,
            detail="The authentication code has expired or was already used. Please try connecting again.",
        )
    elif error_code == "invalid_client_id":
        raise HTTPException(
            status_code=400,
            detail="Invalid application configuration. Please contact support.",
        )
    elif error_code == "invalid_client_secret":
        raise HTTPException(
            status_code=400,
            detail="Invalid application configuration. Please contact support.",
        )
    else:
        raise HTTPException(status_code=400, detail=f"Slack authorization error: {error_message}")


async def _create_or_update_workspace(
    db: AsyncSession, team_id: str, team_name: str, team_domain: str, access_token: str
) -> SlackWorkspace:
    """
    Create a new workspace or update an existing one.

    Args:
        db: Database session
        team_id: Slack team ID
        team_name: Slack team name
        team_domain: Slack team domain
        access_token: Slack OAuth access token

    Returns:
        Created or updated SlackWorkspace object
    """
    # Check if workspace already exists
    result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.slack_id == team_id))
    existing_workspace = result.scalars().first()

    now = datetime.utcnow()

    if existing_workspace:
        # Update existing workspace
        workspace = existing_workspace
        workspace.name = team_name
        workspace.domain = team_domain
        workspace.access_token = access_token
        workspace.is_connected = True
        workspace.connection_status = "active"
        workspace.last_connected_at = now
    else:
        # Create new workspace
        workspace = SlackWorkspace(
            slack_id=team_id,
            name=team_name,
            domain=team_domain,
            access_token=access_token,
            is_connected=True,
            connection_status="active",
            last_connected_at=now,
        )
        db.add(workspace)

    # Save the basic workspace information
    await db.commit()
    await db.refresh(workspace)

    return workspace


async def _fetch_workspace_metadata(db_bind, workspace_id: str) -> None:
    """
    Fetch and update workspace metadata in the background.

    Args:
        db_bind: SQLAlchemy engine bind
        workspace_id: UUID of the workspace to update
    """
    try:
        async with AsyncSession(bind=db_bind) as session:
            result = await session.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
            workspace = result.scalars().first()
            if workspace:
                await WorkspaceService.update_workspace_metadata(session, workspace)
    except Exception as e:
        logger.error(f"Error fetching workspace metadata: {str(e)}")


@router.get("/oauth-callback")
async def slack_oauth_callback(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    code: str = Query(...),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    redirect_from_frontend: Optional[bool] = Query(False),
    client_id: Optional[str] = Query(None),
    client_secret: Optional[str] = Query(None),
) -> Dict[str, str]:
    """
    Handle Slack OAuth callback.

    Args:
        background_tasks: FastAPI background tasks
        db: Database session
        code: Authorization code from Slack
        state: Optional state parameter for CSRF validation
        error: Error message if authorization failed
        redirect_from_frontend: Whether the request came from the frontend
        client_id: Optional client ID if provided from frontend
        client_secret: Optional client secret if provided from frontend

    Returns:
        Dictionary with status message
    """
    if error:
        logger.error(f"Slack OAuth error: {error}")
        raise HTTPException(status_code=400, detail=f"Slack OAuth error: {error}")

    # Client ID must be provided by the user through the UI
    if not client_id:
        logger.error("Slack client ID not provided")
        raise HTTPException(status_code=400, detail="Slack client ID is required")

    # Client secret must be provided by the user through the UI
    if not client_secret:
        logger.error("Slack client secret not provided")
        raise HTTPException(status_code=400, detail="Slack client secret is required")

    # Log the OAuth callback (with only first few chars of the code for security)
    logger.info(f"OAuth callback received with code={code[:5]}... and state={state}")

    try:
        # Exchange code for token and handle errors
        token_data = await _exchange_code_for_token(code, client_id, client_secret)

        # Validate the token response
        oauth_response = SlackOAuthResponse(**token_data)

        # Get workspace info
        team_id = oauth_response.team["id"]
        team_name = oauth_response.team["name"]
        team_domain = oauth_response.team.get("domain", "")

        # Log workspace identification
        logger.info(f"OAuth successful for workspace: {team_name}")

        # Create or update the workspace
        workspace = await _create_or_update_workspace(db, team_id, team_name, team_domain, oauth_response.access_token)

        # Add background task to fetch additional workspace metadata
        # This keeps the OAuth flow fast while still getting the additional data we need
        background_tasks.add_task(_fetch_workspace_metadata, db.bind, str(workspace.id))

        # Return more information for the frontend to create the integration
        return {
            "status": "success",
            "message": f"Connected to {team_name}",
            "access_token": oauth_response.access_token,
            "workspace_id": team_id,
            "workspace_name": team_name,
            "workspace_domain": team_domain,
            "bot_user_id": oauth_response.bot_user_id,
            "scope": oauth_response.scope,
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during Slack OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail="Error connecting to Slack API")
    except Exception as e:
        logger.error(f"Error during Slack OAuth: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during Slack authentication",
        )


@router.get("/workspaces")
async def list_workspaces(
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, list]:
    """
    List connected Slack workspaces.

    Args:
        db: Database session

    Returns:
        Dictionary containing list of workspaces with metadata
    """
    try:
        # We want to show all workspaces, both connected and disconnected
        result = await db.execute(select(SlackWorkspace))
        workspaces = result.scalars().all()

        workspace_list = [
            {
                "id": str(workspace.id),
                "slack_id": workspace.slack_id,
                "name": workspace.name,
                "domain": workspace.domain,
                "icon_url": workspace.icon_url,
                "team_size": workspace.team_size,
                "is_connected": workspace.is_connected,
                "connection_status": workspace.connection_status,
                "last_connected_at": workspace.last_connected_at,
                "last_sync_at": workspace.last_sync_at,
                # Include additional metadata if available
                "metadata": workspace.workspace_metadata or {},
            }
            for workspace in workspaces
        ]

        return {"workspaces": workspace_list}

    except Exception as e:
        logger.error(f"Error listing workspaces: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving workspace data",
        )


async def _get_workspace_by_id(db: AsyncSession, workspace_id: str) -> SlackWorkspace:
    """
    Get a workspace by ID.

    Args:
        db: Database session
        workspace_id: UUID of the workspace to retrieve

    Returns:
        SlackWorkspace object

    Raises:
        HTTPException: If workspace is not found
    """
    result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
    workspace = result.scalars().first()

    if not workspace:
        logger.error(f"Workspace not found: {workspace_id}")
        raise HTTPException(status_code=404, detail="Workspace not found")

    return workspace


async def _update_metadata_background(workspace_id: str) -> None:
    """
    Update workspace metadata in the background.

    Args:
        workspace_id: UUID of the workspace to update
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
            ws = result.scalars().first()
            if ws:
                await WorkspaceService.update_workspace_metadata(session, ws)
                logger.info(f"Background task: metadata updated for {ws.name}")
    except Exception as e:
        logger.error(f"Error in background metadata update: {str(e)}")


def _create_workspace_response(workspace: SlackWorkspace, status: str, message: str) -> Dict[str, Any]:
    """
    Create a response dictionary from workspace data.

    Args:
        workspace: SlackWorkspace object
        status: Response status (success, warning, error)
        message: Response message

    Returns:
        Dictionary with status, message and workspace data
    """
    response = {
        "status": status,
        "message": message,
        "workspace": {
            "id": str(workspace.id),
            "name": workspace.name,
            "is_connected": workspace.is_connected,
            "connection_status": workspace.connection_status,
        },
    }

    # Add additional fields for successful responses
    if status in ["success", "warning"]:
        response["workspace"].update(
            {
                "domain": workspace.domain,
                "icon_url": workspace.icon_url,
                "team_size": workspace.team_size,
            }
        )

    return response


async def _update_metadata_sync(db: AsyncSession, workspace: SlackWorkspace) -> Dict[str, Any]:
    """
    Update workspace metadata synchronously.

    Args:
        db: Database session
        workspace: SlackWorkspace object

    Returns:
        Response dictionary
    """
    try:
        await WorkspaceService.update_workspace_metadata(db, workspace)
        logger.info(
            f"Metadata updated for {workspace.name}. Icon URL: {workspace.icon_url}, Team size: {workspace.team_size}"
        )
        return _create_workspace_response(workspace, "success", f"Token verified for {workspace.name}")
    except Exception as e:
        logger.error(f"Error updating metadata: {str(e)}")
        return _create_workspace_response(
            workspace,
            "warning",
            f"Token verified but error updating metadata: {str(e)}",
        )


@router.get("/workspaces/{workspace_id}/verify")
async def verify_workspace_token(
    workspace_id: str,
    db: AsyncSession = Depends(get_async_db),
    background_tasks: BackgroundTasks = None,
) -> Dict[str, Any]:
    """
    Verify a workspace token and refresh metadata.

    Args:
        workspace_id: UUID of the workspace to verify
        db: Database session
        background_tasks: Optional background tasks for async processing

    Returns:
        Dictionary with verification status
    """
    try:
        # Get the workspace
        workspace = await _get_workspace_by_id(db, workspace_id)

        # Verify the token
        logger.info(f"Verifying token for workspace: {workspace.name}")
        results = await WorkspaceService.verify_workspace_tokens(db, workspace_id)

        # Handle verification failure
        if not results or results[0]["status"] != "verified":
            error_message = "Token verification failed"
            if results and len(results) > 0:
                error_message = results[0]["message"]

            logger.error(f"Token verification failed: {error_message}")
            return _create_workspace_response(workspace, "error", error_message)

        # Handle successful verification
        if background_tasks:
            # Update metadata in background for better UX
            background_tasks.add_task(_update_metadata_background, workspace_id)
            return _create_workspace_response(
                workspace,
                "success",
                f"Token verified for {workspace.name}. Metadata update started in background.",
            )
        else:
            # Update metadata synchronously
            return await _update_metadata_sync(db, workspace)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying workspace token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while verifying the workspace token",
        )


@router.delete("/workspaces/{workspace_id}")
async def disconnect_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, str]:
    """
    Disconnect a Slack workspace.

    Args:
        workspace_id: UUID of the workspace to disconnect
        db: Database session

    Returns:
        Dictionary with status message
    """
    try:
        result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
        workspace = result.scalars().first()

        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")

        # Update workspace status
        workspace.is_connected = False
        workspace.connection_status = "disconnected"
        workspace.access_token = None
        workspace.refresh_token = None

        await db.commit()

        return {"status": "success", "message": f"Disconnected from {workspace.name}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting workspace: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while disconnecting the workspace",
        )
