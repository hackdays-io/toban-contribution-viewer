"""
Slack OAuth integration routes.
"""
import logging
from typing import Dict, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.db.session import get_async_db
from app.models.slack import SlackWorkspace

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
    # No longer accepting redirect_uri from frontend
) -> Dict[str, str]:
    """
    Generate OAuth URL for Slack.
    
    Returns:
        Dictionary containing the OAuth URL.
    """
    if not settings.SLACK_CLIENT_ID:
        logger.error("SLACK_CLIENT_ID is not configured")
        raise HTTPException(
            status_code=500, detail="Slack integration is not properly configured"
        )

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
        "client_id": settings.SLACK_CLIENT_ID,
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


@router.get("/oauth-callback")
async def slack_oauth_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    redirect_from_frontend: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, str]:
    """
    Handle Slack OAuth callback.

    Args:
        code: Authorization code from Slack
        state: Optional state parameter for CSRF validation
        error: Error message if authorization failed
        db: Database session

    Returns:
        Dictionary with status message
    """
    if error:
        logger.error(f"Slack OAuth error: {error}")
        raise HTTPException(status_code=400, detail=f"Slack OAuth error: {error}")

    if not settings.SLACK_CLIENT_ID or not settings.SLACK_CLIENT_SECRET:
        logger.error("Slack credentials not configured")
        raise HTTPException(
            status_code=500, detail="Slack integration is not properly configured"
        )

    try:
        # Exchange the temporary code for an access token
        token_response = requests.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": settings.SLACK_CLIENT_ID,
                "client_secret": settings.SLACK_CLIENT_SECRET.get_secret_value(),
                "code": code,
            },
        )
        token_response.raise_for_status()
        
        # Parse the token response
        token_data = token_response.json()
        
        if not token_data.get("ok"):
            logger.error(f"Slack API error: {token_data.get('error')}")
            raise HTTPException(
                status_code=400, 
                detail=f"Slack API error: {token_data.get('error')}"
            )

        # Validate the token response
        oauth_response = SlackOAuthResponse(**token_data)
        
        # Get team info
        team_id = oauth_response.team["id"]
        team_name = oauth_response.team["name"]
        team_domain = oauth_response.team.get("domain", "")
        
        # Check if workspace already exists
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == team_id)
        )
        existing_workspace = result.scalars().first()
        
        # Create or update the workspace
        if existing_workspace:
            # Update existing workspace
            existing_workspace.name = team_name
            existing_workspace.domain = team_domain
            existing_workspace.access_token = oauth_response.access_token
            existing_workspace.is_connected = True
            existing_workspace.connection_status = "active"
        else:
            # Create new workspace
            new_workspace = SlackWorkspace(
                slack_id=team_id,
                name=team_name,
                domain=team_domain,
                access_token=oauth_response.access_token,
                is_connected=True,
                connection_status="active",
            )
            db.add(new_workspace)
        
        await db.commit()
        
        return {"status": "success", "message": f"Connected to {team_name}"}
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during Slack OAuth: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error connecting to Slack API"
        )
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
        Dictionary containing list of workspaces
    """
    try:
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.is_active.is_(True))
        )
        workspaces = result.scalars().all()
        
        workspace_list = [
            {
                "id": str(workspace.id),
                "slack_id": workspace.slack_id,
                "name": workspace.name,
                "domain": workspace.domain,
                "is_connected": workspace.is_connected,
                "connection_status": workspace.connection_status,
                "last_connected_at": workspace.last_connected_at,
                "last_sync_at": workspace.last_sync_at,
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
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
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