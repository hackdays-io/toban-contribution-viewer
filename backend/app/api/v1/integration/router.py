"""
API endpoints for integration management.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.integration.schemas import (
    AnalysisOptions,
    ChannelSelectionRequest,
    IntegrationCreate,
    IntegrationResponse,
    IntegrationShareCreate,
    IntegrationShareResponse,
    IntegrationTypeEnum,
    IntegrationUpdate,
    ResourceAccessCreate,
    ResourceAccessResponse,
    ServiceResourceResponse,
    SlackIntegrationCreate,
    TeamInfo,
    UserInfo,
)

# Import the analysis response models from the Slack API
from app.api.v1.slack.analysis import (
    AnalysisResponse,
    StoredAnalysisResponse,
)
from app.core.auth import get_current_user
from app.db.session import get_async_db
from app.models.integration import (
    AccessLevel,
    Integration,
    IntegrationCredential,
    IntegrationType,
    ResourceType,
    ServiceResource,
    ShareLevel,
)
from app.models.reports import ResourceAnalysis, AnalysisResourceType, AnalysisType
from app.models.slack import SlackChannel, SlackWorkspace
# Legacy SlackChannelAnalysis import removed
from app.services.integration.base import IntegrationService
from app.services.integration.slack import SlackIntegrationService
from app.services.llm.analysis_store import AnalysisStoreService
from app.services.llm.openrouter import OpenRouterService
from app.services.slack.api import SlackApiError
from app.services.slack.channels import ChannelService
from app.services.slack.messages import (
    SlackMessageService,
    get_channel_messages,
    get_channel_users,
)
from app.services.team.permissions import has_team_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def convert_resource_to_response(resource: ServiceResource) -> Dict:
    """Convert a ServiceResource model to a format compatible with ServiceResourceResponse."""
    return {
        "id": resource.id,
        "integration_id": resource.integration_id,
        "resource_type": resource.resource_type,
        "external_id": resource.external_id,
        "name": resource.name,
        "metadata": resource.resource_metadata,  # Map resource_metadata to metadata
        "last_synced_at": resource.last_synced_at,
        "created_at": resource.created_at,
        "updated_at": resource.updated_at,
    }


def prepare_integration_response(integration) -> IntegrationResponse:
    """
    Converts an Integration model to an IntegrationResponse schema.
    Handles the field mappings and makes sure all required fields are present.
    """
    # Create the owner_team object
    # Make sure owner_team is loaded to prevent MissingGreenlet errors in async context
    if hasattr(integration, "owner_team") and integration.owner_team is not None:
        owner_team = TeamInfo(
            id=integration.owner_team.id,
            name=integration.owner_team.name,
            slug=integration.owner_team.slug,
        )
    else:
        # Fall back to just using owner_team_id if the relationship isn't loaded
        owner_team = TeamInfo(
            id=integration.owner_team_id,
            name="Unknown Team",  # Default name if relationship not loaded
            slug="unknown",  # Default slug if relationship not loaded
        )

    # Create the created_by object - this was previously missing
    created_by = UserInfo(id=integration.created_by_user_id)

    # Convert integration_metadata to metadata and ensure it's a dict
    metadata = (
        integration.integration_metadata
        if integration.integration_metadata is not None
        else {}
    )

    # Convert credentials to the proper format
    credentials_list = []
    if hasattr(integration, "credentials") and integration.credentials:
        for credential in integration.credentials:
            credentials_list.append(
                {
                    "id": credential.id,
                    "credential_type": credential.credential_type,
                    "expires_at": credential.expires_at,
                    "scopes": credential.scopes,
                    "created_at": credential.created_at,
                    "updated_at": credential.updated_at,
                }
            )

    # Convert resources to the proper format
    resource_list = []
    if hasattr(integration, "resources") and integration.resources:
        resource_list = [
            convert_resource_to_response(resource) for resource in integration.resources
        ]

    # Convert shared_with to the proper format
    shares_list = []
    if hasattr(integration, "shared_with") and integration.shared_with:
        for share in integration.shared_with:
            # Create the team info object for this share
            # Check if team relationship is loaded
            if hasattr(share, "team") and share.team:
                team_info = TeamInfo(
                    id=share.team.id,
                    name=share.team.name,
                    slug=share.team.slug,
                )
            else:
                # Fall back to just the team_id if relationship isn't loaded
                team_info = TeamInfo(
                    id=share.team_id,
                    name="Unknown Team",
                    slug="unknown",
                )

            # Create the shared_by user info
            shared_by = UserInfo(id=share.shared_by_user_id)

            shares_list.append(
                {
                    "id": share.id,
                    "integration_id": share.integration_id,
                    "team_id": share.team_id,
                    "share_level": share.share_level.value,
                    "status": share.status,
                    "revoked_at": share.revoked_at,
                    "shared_by": shared_by,
                    "team": team_info,
                    "created_at": share.created_at,
                    "updated_at": share.updated_at,
                }
            )

    # Create the response object with all required fields
    response = IntegrationResponse(
        id=integration.id,
        name=integration.name,
        description=integration.description,
        service_type=integration.service_type.value,
        status=integration.status.value,
        metadata=metadata,
        last_used_at=integration.last_used_at,
        owner_team=owner_team,
        created_by=created_by,
        created_at=integration.created_at,
        updated_at=integration.updated_at,
        # Use the converted lists instead of the raw DB models
        credentials=credentials_list,
        resources=resource_list,
        shared_with=shares_list,
    )

    return response


@router.get("", response_model=List[IntegrationResponse])
async def get_integrations(
    team_id: Optional[uuid.UUID] = None,
    service_type: Optional[IntegrationTypeEnum] = None,
    include_shared: bool = True,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get integrations for the current user's teams.

    Args:
        team_id: Optional team ID to filter by
        service_type: Optional service type to filter by
        include_shared: Whether to include integrations shared with the user's teams
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of integrations
    """
    # Check permissions if team_id is provided
    if team_id:
        # Verify the user has access to this team
        if not await has_team_permission(db, team_id, current_user["id"], "read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this team",
            )

        # Get integrations for the specified team
        integrations = await IntegrationService.get_team_integrations(
            db=db,
            team_id=team_id,
            include_shared=include_shared,
            service_type=service_type.value if service_type else None,
        )
    else:
        # Get all teams the user has access to
        # This would be implemented based on your team permission model
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="team_id is required",
        )

    # Convert each integration to a proper response
    return [prepare_integration_response(integration) for integration in integrations]


@router.post(
    "", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED
)
async def create_integration(
    integration: IntegrationCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new integration.

    Args:
        integration: Integration data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Newly created integration
    """
    # Verify the user has permission to create integrations for this team
    if not await has_team_permission(
        db, integration.team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create integrations for this team",
        )

    # Create or update the integration
    new_integration = await IntegrationService.create_integration(
        db=db,
        team_id=integration.team_id,
        user_id=current_user["id"],
        name=integration.name,
        service_type=IntegrationType(integration.service_type.value),
        description=integration.description,
        workspace_id=integration.workspace_id,
        metadata=integration.metadata,
    )

    # Commit the transaction
    await db.commit()

    # Reload the integration with all relationships to prevent MissingGreenlet errors
    # when preparing the response
    stmt = (
        select(Integration)
        .where(Integration.id == new_integration.id)
        .options(
            selectinload(Integration.owner_team),
            selectinload(Integration.credentials),
            selectinload(Integration.shared_with),
            selectinload(Integration.resources),
            selectinload(Integration.events),
        )
    )
    result = await db.execute(stmt)
    loaded_integration = result.scalar_one_or_none() or new_integration

    # Check if the updated flag exists and preserve it when reloading
    was_updated = getattr(new_integration, "updated", False)
    if was_updated:
        loaded_integration.__dict__["updated"] = was_updated

    # Convert to response format
    response_data = prepare_integration_response(loaded_integration)

    # Add the updated flag to the response
    response_dict = response_data.dict()
    response_dict["updated"] = was_updated

    return JSONResponse(
        content=jsonable_encoder(response_dict), status_code=status.HTTP_201_CREATED
    )


@router.post("/slack", response_model=IntegrationResponse)
async def create_slack_integration(
    integration: SlackIntegrationCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create or update a Slack integration via OAuth.

    This endpoint handles both new integrations and reconnection of existing
    integrations based on the workspace ID from the OAuth flow. If an integration
    for the same Slack workspace already exists for this team, it will be updated
    instead of creating a duplicate.

    Args:
        integration: Slack integration data including OAuth code
        db: Database session
        current_user: Current authenticated user

    Returns:
        Created or updated integration
    """
    # Verify the user has permission to create integrations for this team
    if not await has_team_permission(
        db, integration.team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create integrations for this team",
        )

    try:
        # Client ID and secret are now provided by the user through the UI
        # These values should always be present in the request
        client_id = integration.client_id
        client_secret = integration.client_secret

        if not client_id or not client_secret:
            raise ValueError("Slack client ID and client secret are required")

        # Use the OAuth flow handler to create or update the integration
        integration_result, workspace_info = (
            await SlackIntegrationService.handle_oauth_flow(
                db=db,
                team_id=integration.team_id,
                user_id=current_user["id"],
                auth_code=integration.code,
                redirect_uri=integration.redirect_uri,
                client_id=client_id,
                client_secret=client_secret,
                name=integration.name,
                description=integration.description,
            )
        )

        # Determine if this was a new integration or an update to an existing one
        # We'll use this to set the appropriate status code
        is_new = not integration_result.created_at or (
            integration_result.created_at
            and (datetime.utcnow() - integration_result.created_at).total_seconds() < 60
        )

        # Commit the transaction
        await db.commit()

        # Prepare the response with the integration data
        response_data = prepare_integration_response(integration_result)

        # Convert to dict to allow adding fields not in the model
        response_dict = response_data.dict()

        # Add a flag to indicate if this was an update to an existing integration
        response_dict["updated"] = not is_new

        # Set the correct status code
        status_code = status.HTTP_201_CREATED if is_new else status.HTTP_200_OK
        return JSONResponse(
            content=jsonable_encoder(response_dict), status_code=status_code
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            f"Error creating/updating Slack integration: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the integration",
        )


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get a specific integration.

    Args:
        integration_id: UUID of the integration to retrieve
        db: Database session
        current_user: Current authenticated user

    Returns:
        Integration details
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    return prepare_integration_response(integration)


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: uuid.UUID,
    update_data: IntegrationUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Update an integration.

    Args:
        integration_id: UUID of the integration to update
        update_data: Data to update
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated integration
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Verify the user has permission to update this integration
    if not await has_team_permission(
        db, integration.owner_team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this integration",
        )

    # Prepare update data
    update_dict = update_data.dict(exclude_unset=True)
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value
    if "metadata" in update_dict:
        update_dict["integration_metadata"] = update_dict.pop("metadata")

    # Update the integration
    updated_integration = await IntegrationService.update_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
        data=update_dict,
    )

    # Commit the transaction
    await db.commit()

    return prepare_integration_response(updated_integration)


@router.get("/{integration_id}/resources", response_model=List[ServiceResourceResponse])
async def get_integration_resources(
    integration_id: uuid.UUID,
    resource_type: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get resources for an integration.

    Args:
        integration_id: UUID of the integration
        resource_type: Optional resource types to filter by
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of resources
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Get the resources
    resources = await IntegrationService.get_integration_resources(
        db=db,
        integration_id=integration_id,
        resource_types=resource_type,
    )

    # Convert SQLAlchemy model objects to Pydantic schema objects with basic info
    response_resources = [
        convert_resource_to_response(resource) for resource in resources
    ]

    # If we have Slack channels, we need to add the selection status from SlackChannel table
    if integration.service_type == IntegrationType.SLACK and any(
        r.resource_type == ResourceType.SLACK_CHANNEL for r in resources
    ):
        # Get slack workspace ID from integration metadata
        metadata: Dict[str, Any] = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if slack_workspace_id:
            # Find the workspace in the database to get its UUID
            workspace_result = await db.execute(
                select(SlackWorkspace).where(
                    SlackWorkspace.slack_id == slack_workspace_id
                )
            )
            workspace = workspace_result.scalars().first()

            if workspace:
                # Try to get selected channels from SlackChannel table
                selected_channels_result = await db.execute(
                    select(SlackChannel.slack_id).where(
                        SlackChannel.workspace_id == workspace.id,
                        SlackChannel.is_selected_for_analysis.is_(True),
                    )
                )
                selected_channels = [
                    row[0] for row in selected_channels_result.fetchall()
                ]
                logger.debug(
                    f"Found {len(selected_channels)} selected channels in SlackChannel table for workspace {workspace.id}"
                )

                # If we don't have any selected channels, check if we need to populate data
                if not selected_channels:
                    # Count how many SlackChannel records exist for this workspace
                    channel_count_result = await db.execute(
                        select(func.count()).where(
                            SlackChannel.workspace_id == workspace.id
                        )
                    )
                    channel_count = channel_count_result.scalar_one_or_none() or 0

                    if channel_count == 0:
                        logger.info(
                            f"No SlackChannel records found for workspace {workspace.id}. Creating from ServiceResource..."
                        )

                        # Get all resources for this integration
                        channel_resources_result = await db.execute(
                            select(ServiceResource).where(
                                ServiceResource.integration_id == integration_id,
                                ServiceResource.resource_type
                                == ResourceType.SLACK_CHANNEL,
                            )
                        )
                        channel_resources = channel_resources_result.scalars().all()

                        # Create SlackChannel records from ServiceResource records
                        created_count = 0
                        for resource in channel_resources:
                            metadata = resource.resource_metadata or {}

                            # Create a new SlackChannel record
                            new_channel = SlackChannel(
                                id=resource.id,  # Use the same ID as the resource
                                workspace_id=workspace.id,
                                slack_id=resource.external_id,
                                name=resource.name.lstrip(
                                    "#"
                                ),  # Remove the # prefix if present
                                type=metadata.get("type", "public"),
                                is_selected_for_analysis=False,  # Default to not selected
                                is_supported=True,
                                purpose=metadata.get("purpose", ""),
                                topic=metadata.get("topic", ""),
                                member_count=metadata.get("member_count", 0),
                                is_archived=metadata.get("is_archived", False),
                                last_sync_at=resource.last_synced_at,
                            )
                            db.add(new_channel)
                            created_count += 1

                        logger.info(
                            f"Created {created_count} new SlackChannel records from resources"
                        )
                        if created_count > 0:
                            await db.commit()

                            # Re-query for selected channels just in case any were already selected
                            selected_channels_result = await db.execute(
                                select(SlackChannel.slack_id).where(
                                    SlackChannel.workspace_id == workspace.id,
                                    SlackChannel.is_selected_for_analysis.is_(True),
                                )
                            )
                            selected_channels = [
                                row[0] for row in selected_channels_result.fetchall()
                            ]
                            logger.info(
                                f"After migration, found {len(selected_channels)} selected channels in workspace {workspace.id}"
                            )

                # Update the response resources with selection status
                for resource in response_resources:
                    if resource["resource_type"] == ResourceType.SLACK_CHANNEL:
                        # Ensure metadata dictionary exists
                        if "metadata" not in resource or resource["metadata"] is None:
                            resource["metadata"] = {}

                        # Set selection status based on whether the channel is in our list
                        external_id = resource.get("external_id")
                        is_selected = external_id in selected_channels

                        # Add at both top level and in metadata for backward compatibility
                        resource["metadata"]["is_selected_for_analysis"] = is_selected
                        resource["is_selected_for_analysis"] = is_selected

                        # Get the channel record to check if the bot is in the channel
                        channel_record_result = await db.execute(
                            select(SlackChannel).where(
                                SlackChannel.workspace_id == workspace.id,
                                SlackChannel.slack_id == external_id,
                            )
                        )
                        channel_record = channel_record_result.scalars().first()
                        has_bot = channel_record.has_bot if channel_record else False

                        # Add has_bot at both top level and in metadata for consistency
                        resource["metadata"]["has_bot"] = has_bot
                        resource["has_bot"] = has_bot

                        #logger.debug(
                        #    f"Channel {resource['name']} (id={external_id}): is_selected_for_analysis={is_selected}, has_bot={has_bot}"
                        #)

    return response_resources


@router.post("/{integration_id}/sync", response_model=Dict)
async def sync_integration_resources(
    integration_id: uuid.UUID,
    resource_types: Optional[List[str]] = Query(None),
    slack_token: Optional[str] = Header(None),  # Accept token from header
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Sync resources for an integration.

    Args:
        integration_id: UUID of the integration
        resource_types: Optional resource types to sync
        slack_token: Optional Slack token provided in the header
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Verify the user has permission to sync this integration
    if not await has_team_permission(
        db, integration.owner_team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to sync this integration",
        )

    # Check the integration type and sync the resources
    try:
        if integration.service_type == IntegrationType.SLACK:
            try:
                # Attempt to sync with the database token
                token = await SlackIntegrationService.get_token(db, integration_id)

                if not token:
                    # Check if we can get the token from credentials associated with this integration
                    logger.info(
                        f"No token found in database for integration {integration_id}, checking credentials"
                    )

                    # Get the credential if it exists
                    stmt = select(IntegrationCredential).where(
                        IntegrationCredential.integration_id == integration_id,
                        IntegrationCredential.credential_type == "oauth_token",
                    )
                    credential_result = await db.execute(stmt)
                    credential = credential_result.scalar_one_or_none()

                    if credential and credential.encrypted_value:
                        token = credential.encrypted_value
                        logger.info(
                            f"Found token in credentials for integration {integration_id}"
                        )
                    else:
                        # Check if token exists in metadata (for backward compatibility)
                        metadata = integration.integration_metadata or {}
                        if metadata.get("access_token"):
                            token = metadata["access_token"]
                            logger.info(
                                f"Found token in metadata for integration {integration_id}"
                            )
                        else:
                            raise ValueError(
                                "No access token found for this integration. Please reconnect your Slack workspace."
                            )

                # Sync channels and users (these return ServiceResource objects)
                channel_resources = await SlackIntegrationService.sync_channels(
                    db=db,
                    integration_id=integration_id,
                )

                user_resources = await SlackIntegrationService.sync_users(
                    db=db,
                    integration_id=integration_id,
                )

                # Commit the transaction
                await db.commit()

                # Return counts only, not the actual resources (to avoid conversion issues)
                channel_count = len(channel_resources) if channel_resources else 0
                user_count = len(user_resources) if user_resources else 0

            except ValueError as e:
                # For all ValueError types, re-raise
                logger.error(
                    f"Error syncing resources for integration {integration_id}: {str(e)}"
                )
                raise

            return {
                "status": "success",
                "message": "Resources synced successfully",
                "synced": {
                    "channels": channel_count,
                    "users": user_count,
                },
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sync not implemented for {integration.service_type} integrations",
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error syncing resources: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while syncing resources",
        )


@router.post(
    "/{integration_id}/resources/{resource_id}/sync-messages", response_model=Dict
)
async def sync_resource_messages(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    start_date: Optional[datetime] = Query(
        None, description="Start date for messages to sync (defaults to 30 days ago)"
    ),
    end_date: Optional[datetime] = Query(
        None, description="End date for messages to sync (defaults to current date)"
    ),
    include_replies: bool = Query(
        True, description="Whether to include thread replies in the sync"
    ),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Sync messages for a specific channel resource associated with an integration.

    This endpoint is specifically designed for syncing Slack channel messages before running analysis.
    It ensures the most up-to-date messages are available in the database.

    Args:
        integration_id: UUID of the integration
        resource_id: UUID of the resource (channel)
        start_date: Optional start date for messages to sync
        end_date: Optional end date for messages to sync
        include_replies: Whether to include thread replies
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message with sync statistics
    """
    try:
        # Default to last 30 days if dates not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the Slack workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel from the database
        # First, try to get the SlackChannel record
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        # If no SlackChannel record exists, try to create one from the resource
        if not channel:
            # Create a new SlackChannel record from the ServiceResource
            logger.info(f"Creating new SlackChannel record for resource {resource_id}")
            channel = SlackChannel(
                id=resource.id,
                workspace_id=workspace.id,
                slack_id=resource.external_id,
                name=resource.name.lstrip("#"),  # Remove # prefix if present
                type=(
                    resource.resource_metadata.get("type", "public")
                    if resource.resource_metadata
                    else "public"
                ),
                is_selected_for_analysis=True,  # Mark as selected since we're analyzing it
                is_supported=True,
                purpose=(
                    resource.resource_metadata.get("purpose", "")
                    if resource.resource_metadata
                    else ""
                ),
                topic=(
                    resource.resource_metadata.get("topic", "")
                    if resource.resource_metadata
                    else ""
                ),
                member_count=(
                    resource.resource_metadata.get("member_count", 0)
                    if resource.resource_metadata
                    else 0
                ),
                is_archived=(
                    resource.resource_metadata.get("is_archived", False)
                    if resource.resource_metadata
                    else False
                ),
                last_sync_at=datetime.utcnow(),
            )
            db.add(channel)
            await db.commit()
            await db.refresh(channel)
            logger.info(
                f"Created new SlackChannel record: {channel.id} - {channel.name}"
            )

        # Sync channel messages using the SlackMessageService
        sync_results = await SlackMessageService.sync_channel_messages(
            db=db,
            workspace_id=str(workspace.id),
            channel_id=str(channel.id),
            start_date=start_date,
            end_date=end_date,
            include_replies=include_replies,
            sync_threads=include_replies,  # Sync thread replies if requested
        )

        # Update the channel's last_sync_at
        channel.last_sync_at = datetime.utcnow()
        await db.commit()

        return {
            "status": "success",
            "message": "Channel messages synced successfully",
            "sync_results": sync_results,
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle specific known errors
        logger.error(f"Error syncing channel messages: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Log and raise a generic error
        logger.error(f"Error syncing channel messages: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing channel messages: {str(e)}",
        )


@router.post("/{integration_id}/share", response_model=IntegrationShareResponse)
async def share_integration(
    integration_id: uuid.UUID,
    share: IntegrationShareCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Share an integration with another team.

    Args:
        integration_id: UUID of the integration to share
        share: Share details
        db: Database session
        current_user: Current authenticated user

    Returns:
        Share details
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Verify the user has permission to share this integration
    if not await has_team_permission(
        db, integration.owner_team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to share this integration",
        )

    # Verify the user has permission to share with the target team
    if not await has_team_permission(db, share.team_id, current_user["id"], "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to share with the target team",
        )

    # Share the integration
    share_result = await IntegrationService.share_integration(
        db=db,
        integration_id=integration_id,
        team_id=share.team_id,
        user_id=current_user["id"],
        share_level=ShareLevel(share.share_level.value),
    )

    # Commit the transaction
    await db.commit()

    # Get the created share with relationships
    # This would need to be expanded in a real implementation
    return share_result


@router.delete("/{integration_id}/share/{team_id}")
async def revoke_integration_share(
    integration_id: uuid.UUID,
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Revoke an integration share from a team.

    Args:
        integration_id: UUID of the integration
        team_id: UUID of the team to revoke from
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Verify the user has permission to revoke sharing for this integration
    has_owner_permission = await has_team_permission(
        db, integration.owner_team_id, current_user["id"], "admin"
    )
    has_target_permission = await has_team_permission(
        db, team_id, current_user["id"], "admin"
    )

    if not (has_owner_permission or has_target_permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to revoke this share",
        )

    # Revoke the share
    success = await IntegrationService.revoke_integration_share(
        db=db,
        integration_id=integration_id,
        team_id=team_id,
        user_id=current_user["id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Commit the transaction
    await db.commit()

    return {"status": "success", "message": "Share revoked successfully"}


@router.post(
    "/{integration_id}/resources/{resource_id}/access",
    response_model=ResourceAccessResponse,
)
async def grant_resource_access(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    access: ResourceAccessCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Grant a team access to a resource.

    Args:
        integration_id: UUID of the integration
        resource_id: UUID of the resource
        access: Access details
        db: Database session
        current_user: Current authenticated user

    Returns:
        Access details
    """
    # Get the integration
    integration = await IntegrationService.get_integration(
        db=db,
        integration_id=integration_id,
        user_id=current_user["id"],
    )

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    # Get the resource
    stmt = await db.execute(
        select(ServiceResource)
        .options(selectinload(ServiceResource.integration))
        .where(ServiceResource.id == resource_id)
    )
    resource = stmt.scalar_one_or_none()

    if not resource or resource.integration_id != integration_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    # Verify the user has permission to manage resource access
    if not await has_team_permission(
        db, integration.owner_team_id, current_user["id"], "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage resource access",
        )

    # Grant access
    access_result = await IntegrationService.grant_resource_access(
        db=db,
        resource_id=resource_id,
        team_id=access.team_id,
        user_id=current_user["id"],
        access_level=AccessLevel(access.access_level.value),
    )

    # Commit the transaction
    await db.commit()

    # Get the created access with relationships
    # This would need to be expanded in a real implementation
    return access_result


@router.post("/{integration_id}/resources/channel-selection")
async def select_channels_for_integration(
    integration_id: uuid.UUID,
    selection: ChannelSelectionRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Select or deselect channels for analysis.

    Args:
        integration_id: UUID of the integration
        selection: Channel selection request with channel_ids and for_analysis flag
        db: Database session
        current_user: Current authenticated user

    Returns:
        Dictionary with selection results
    """
    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Check if this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the workspace ID from the integration metadata
        metadata: Dict[str, Any] = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database using slack_id
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Slack workspace with ID {slack_workspace_id} not found",
            )

        # First, check if we need to create SlackChannel records for these channels
        # Get the resources for each channel ID
        missing_channel_count = 0
        for channel_id in selection.channel_ids:
            # Check if a SlackChannel record exists for this channel
            slack_channel_result = await db.execute(
                select(SlackChannel).where(SlackChannel.id == channel_id)
            )
            slack_channel = slack_channel_result.scalars().first()

            if not slack_channel:
                # Channel doesn't exist in SlackChannel table, check if it exists in ServiceResource
                resource_result = await db.execute(
                    select(ServiceResource).where(
                        ServiceResource.id == channel_id,
                        ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
                    )
                )
                resource = resource_result.scalars().first()

                if resource:
                    # Create a new SlackChannel record from the ServiceResource
                    logger.debug(
                        f"Creating new SlackChannel record for {resource.name} (id={resource.id})"
                    )
                    metadata = resource.resource_metadata or {}

                    new_channel = SlackChannel(
                        id=resource.id,  # Use the same ID as the resource
                        workspace_id=workspace.id,
                        slack_id=resource.external_id,
                        name=resource.name.lstrip(
                            "#"
                        ),  # Remove the # prefix if present
                        type=metadata.get("type", "public"),
                        is_selected_for_analysis=selection.for_analysis,
                        is_supported=True,
                        purpose=metadata.get("purpose", ""),
                        topic=metadata.get("topic", ""),
                        member_count=metadata.get("member_count", 0),
                        is_archived=metadata.get("is_archived", False),
                        last_sync_at=resource.last_synced_at,
                    )
                    db.add(new_channel)
                    missing_channel_count += 1

        if missing_channel_count > 0:
            logger.info(f"Created {missing_channel_count} new SlackChannel records")
            await db.commit()

        # Call the channel selection service with the database UUID
        result = await ChannelService.select_channels_for_analysis(
            db=db,
            workspace_id=str(workspace.id),  # Use the UUID from the database
            channel_ids=selection.channel_ids,
            install_bot=True,  # Default to installing bot
            for_analysis=selection.for_analysis,  # Use the frontend's flag
        )

        # Commit the changes
        await db.commit()

        return {
            "status": "success",
            "message": f"Channels {'selected for' if selection.for_analysis else 'removed from'} analysis",
            "integration_id": str(integration_id),
            "workspace_id": str(workspace.id),
            "slack_workspace_id": slack_workspace_id,
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error selecting channels: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while selecting channels for analysis",
        )


@router.post(
    "/{integration_id}/resources/{resource_id}/sync-messages",
    summary="Sync messages for a specific channel via team integration before analysis",
    description="Syncs messages for a Slack channel associated with a team integration to ensure the latest messages are available for analysis.",
)
async def sync_integration_resource_messages(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    start_date: Optional[datetime] = Query(
        None, description="Start date for syncing messages (defaults to 30 days ago)"
    ),
    end_date: Optional[datetime] = Query(
        None, description="End date for syncing messages (defaults to current date)"
    ),
    include_replies: bool = Query(
        True, description="Whether to include thread replies in the sync"
    ),
    sync_threads: bool = Query(
        True, description="Whether to explicitly sync thread replies after message sync"
    ),
    thread_days: int = Query(
        30, ge=1, le=90, description="Number of days of thread messages to sync"
    ),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Sync messages for a Slack channel to ensure data is up-to-date for analysis.

    This endpoint:
    1. Validates that the resource is a Slack channel associated with the integration
    2. Initiates message synchronization for the channel
    3. Returns synchronization statistics
    """
    # Log basic request information
    logger.info(
        f"Received sync-messages request: integration_id={integration_id}, resource_id={resource_id}"
    )

    # Initialize variables outside the try block for error handling
    workspace = None
    channel = None

    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the Slack workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel from the database
        # First, try to get the SlackChannel record
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        # If no direct SlackChannel record, try to create one from the resource
        if not channel:
            # Create a SlackChannel record from the resource
            channel = SlackChannel(
                id=resource.id,
                workspace_id=workspace.id,
                slack_id=resource.external_id,
                name=resource.name.lstrip("#"),  # Remove # prefix if present
                type=(
                    resource.resource_metadata.get("type", "public")
                    if resource.resource_metadata
                    else "public"
                ),
                is_selected_for_analysis=True,  # Assume selected since we're analyzing it
                is_supported=True,
                purpose=(
                    resource.resource_metadata.get("purpose", "")
                    if resource.resource_metadata
                    else ""
                ),
                topic=(
                    resource.resource_metadata.get("topic", "")
                    if resource.resource_metadata
                    else ""
                ),
                member_count=(
                    resource.resource_metadata.get("member_count", 0)
                    if resource.resource_metadata
                    else 0
                ),
                is_archived=(
                    resource.resource_metadata.get("is_archived", False)
                    if resource.resource_metadata
                    else False
                ),
                last_sync_at=resource.last_synced_at,
            )
            db.add(channel)
            await db.commit()

        # Default to last 30 days if dates not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Log basic operation
        logger.info(
            f"Syncing messages for channel {channel.name} ({channel.slack_id}) in workspace {workspace.name}"
        )

        # Use SlackMessageService to sync messages
        sync_results = await SlackMessageService.sync_channel_messages(
            db=db,
            workspace_id=str(workspace.id),
            channel_id=str(channel.id),
            start_date=start_date,
            end_date=end_date,
            include_replies=include_replies,
            sync_threads=sync_threads,
            thread_days=thread_days,
        )

        # Log results summary
        logger.info(
            f"Sync completed: {sync_results.get('new_message_count', 0)} messages and {sync_results.get('replies_synced', 0)} thread replies synced"
        )

        # Return sync results
        return {
            "status": "success",
            "message": f"Synced {sync_results.get('new_message_count', 0)} messages and {sync_results.get('replies_synced', 0)} thread replies",
            "sync_results": sync_results,
            "workspace_id": str(workspace.id),
            "channel_id": str(channel.id),
        }

    except SlackApiError as e:
        logger.error(f"Slack API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error from Slack API: {str(e)}",
        )
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        logger.warning(f"HTTP exception in sync-messages: {http_ex.detail}")
        raise
    except ValueError as val_err:
        logger.error(f"ValueError in sync-messages: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err)
        )
    except Exception as e:
        logger.error(f"Unexpected error syncing messages: {str(e)}", exc_info=True)
        # Return a more detailed error for debugging
        try:
            error_context = {
                "workspace_id": str(workspace.id) if workspace else "unknown",
                "channel_id": str(channel.id) if channel else "unknown",
                "slack_channel_id": (
                    channel.slack_id
                    if channel and hasattr(channel, "slack_id")
                    else "unknown"
                ),
                "error_type": type(e).__name__,
                "error_message": str(e),
            }
        except Exception as ctx_err:
            error_context = {
                "context_error": f"Failed to create error context: {str(ctx_err)}",
                "error_type": type(e).__name__,
                "error_message": str(e),
            }

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing messages: {str(e)}. Context: {error_context}",
        )


@router.post(
    "/{integration_id}/resources/{resource_id}/analyze",
    response_model=AnalysisResponse,
    summary="Analyze a Slack channel via team integration",
    description="Uses LLM to analyze messages in a Slack channel associated with a team integration and provide insights about communication patterns, key contributors, and discussion topics.",
)
async def analyze_integration_resource(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    analysis_options: AnalysisOptions,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    # Extract options from the request body
    start_date = analysis_options.start_date
    end_date = analysis_options.end_date
    include_threads = analysis_options.include_threads
    include_reactions = analysis_options.include_reactions
    model = analysis_options.model
    """
    Analyze messages in a Slack channel using LLM to provide insights.

    This endpoint:
    1. Validates that the resource is a Slack channel associated with the integration
    2. Retrieves messages for the specified channel and date range
    3. Processes messages into a format suitable for LLM analysis
    4. Sends data to OpenRouter LLM API for analysis
    5. Returns structured insights about communication patterns

    The analysis includes:
    - Channel summary (purpose, activity patterns)
    - Topic analysis (main discussion topics)
    - Contributor insights (key contributors and their patterns)
    - Key highlights (notable discussions worth attention)
    """
    # Handle date parameters with detailed logging
    logger.info(
        f"analyze_integration_resource - Received date parameters - start_date: {start_date}, end_date: {end_date}"
    )

    # Store the original provided start date if it exists
    original_start_date = None
    if start_date:
        original_start_date = start_date
        logger.info(f"Preserving original provided start_date: {original_start_date}")

    # Default to last 30 days only if dates not provided
    if not end_date:
        end_date = datetime.utcnow()
        logger.info(f"Using default end_date: {end_date}")
    else:
        logger.info(f"Using provided end_date: {end_date}")

    if not start_date:
        start_date = end_date - timedelta(days=30)
        logger.info(f"Using default start_date (30 days before end): {start_date}")
    else:
        logger.info(f"Using provided start_date: {start_date}")

    # Extra validation to ensure start_date is respected
    if original_start_date:
        logger.info(
            f"Double-checking start_date is preserved: original={original_start_date}, current={start_date}"
        )
        if original_start_date != start_date:
            logger.warning(
                f"start_date was modified! Restoring original: {original_start_date}"
            )
            start_date = original_start_date

    # Create an instance of the OpenRouter service
    llm_service = OpenRouterService()

    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the Slack workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel from the database
        # First, try to get the SlackChannel record
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        # If no direct SlackChannel record, try to create one from the resource
        if not channel:
            # Create a SlackChannel record from the resource
            channel = SlackChannel(
                id=resource.id,
                workspace_id=workspace.id,
                slack_id=resource.external_id,
                name=resource.name.lstrip("#"),  # Remove # prefix if present
                type=(
                    resource.resource_metadata.get("type", "public")
                    if resource.resource_metadata
                    else "public"
                ),
                is_selected_for_analysis=True,  # Assume selected since we're analyzing it
                is_supported=True,
                purpose=(
                    resource.resource_metadata.get("purpose", "")
                    if resource.resource_metadata
                    else ""
                ),
                topic=(
                    resource.resource_metadata.get("topic", "")
                    if resource.resource_metadata
                    else ""
                ),
                member_count=(
                    resource.resource_metadata.get("member_count", 0)
                    if resource.resource_metadata
                    else 0
                ),
                is_archived=(
                    resource.resource_metadata.get("is_archived", False)
                    if resource.resource_metadata
                    else False
                ),
                last_sync_at=resource.last_synced_at,
            )
            db.add(channel)
            await db.commit()

        # Get messages for the channel within the date range
        # Log the dates that will be used in the API call
        logger.info(
            f"analyze_integration_resource - Getting messages with dates: start={start_date}, end={end_date}"
        )

        # Make sure start_date is being properly passed if provided
        if start_date:
            logger.info(
                f"analyze_integration_resource - Using explicit start_date: {start_date.isoformat()}"
            )

            # Extra check - make sure it's properly formatted in the correct ISO format
            if hasattr(start_date, "isoformat"):
                iso_formatted = start_date.isoformat()
                logger.info(
                    f"analyze_integration_resource - ISO formatted start_date: {iso_formatted}"
                )

        # Use the exact start_date passed to the function
        messages = await get_channel_messages(
            db,
            str(workspace.id),  # Use workspace UUID from database
            str(channel.id),  # Use channel UUID from database
            start_date=start_date,  # Use exactly what was passed (which should be original_start_date if provided)
            end_date=end_date,
            include_replies=include_threads,
        )

        # Log how many messages were found
        logger.info(
            f"analyze_integration_resource - Found {len(messages)} messages between {start_date} and {end_date}"
        )

        # Get user data for the channel
        users = await get_channel_users(db, str(workspace.id), str(channel.id))

        # Process messages and add user data
        processed_messages = []
        user_dict = {user.slack_id: user for user in users}
        message_count = 0
        thread_count = 0
        reaction_count = 0
        participant_set = set()

        for msg in messages:
            message_count += 1
            if msg.user_id:
                participant_set.add(msg.user_id)

            if msg.is_thread_parent:
                thread_count += 1

            if msg.reaction_count:
                reaction_count += msg.reaction_count

            user = user_dict.get(msg.user_id) if msg.user_id else None

            # Get the Slack user ID (not our database UUID) for proper <@USER_ID> format
            slack_user_id = user.slack_id if user else None
            # Use the user's display name as fallback only if we don't have the Slack ID
            user_name = user.display_name or user.name if user else "Participant"

            processed_messages.append(
                {
                    "id": msg.id,
                    "user_id": slack_user_id,  # This is the Slack user ID, not our UUID
                    "db_user_id": msg.user_id,  # Keep our UUID for reference if needed
                    "user_name": user_name,  # Only used as fallback if slack_user_id is not available
                    "text": msg.text,
                    "timestamp": msg.message_datetime.isoformat(),
                    "is_thread_parent": msg.is_thread_parent,
                    "is_thread_reply": msg.is_thread_reply,
                    "thread_ts": msg.thread_ts,
                    "has_attachments": msg.has_attachments,
                    "reaction_count": msg.reaction_count,
                }
            )

        # Prepare data for LLM analysis
        messages_data = {
            "message_count": message_count,
            "participant_count": len(participant_set),
            "thread_count": thread_count,
            "reaction_count": reaction_count,
            "messages": processed_messages,
        }

        # Call the LLM service to analyze the data
        analysis_results = await llm_service.analyze_channel_messages(
            channel_name=channel.name,
            messages_data=messages_data,
            start_date=start_date,
            end_date=end_date,
            model=model,
        )

        # Store analysis results in the database
        stats = {
            "message_count": message_count,
            "participant_count": len(participant_set),
            "thread_count": thread_count,
            "reaction_count": reaction_count,
        }

        try:
            await AnalysisStoreService.store_channel_analysis(
                db=db,
                workspace_id=str(workspace.id),
                channel_id=str(channel.id),
                start_date=start_date,
                end_date=end_date,
                stats=stats,
                analysis_results=analysis_results,
                model_used=analysis_results.get("model_used", model or ""),
            )
            logger.info(f"Stored analysis for channel {channel.id}")
        except Exception as e:
            logger.error(f"Error storing analysis results: {str(e)}")
            # We'll continue with the API response even if storage fails

        # Build the response with the correct date period
        # Make sure we're respecting the provided date range exactly as it was received
        logger.info(
            f"analyze_integration_resource - Building response with date range: start={start_date}, end={end_date}"
        )

        # Generate a proper UUID for the analysis_id instead of a formatted string
        analysis_uuid = str(uuid.uuid4())
        
        response = AnalysisResponse(
            analysis_id=analysis_uuid,
            channel_id=str(channel.id),
            channel_name=channel.name,
            period={
                "start": start_date,
                "end": end_date,
            },  # Use the dates exactly as provided
            stats=stats,
            channel_summary=analysis_results.get("channel_summary", ""),
            topic_analysis=analysis_results.get("topic_analysis", ""),
            contributor_insights=analysis_results.get("contributor_insights", ""),
            key_highlights=analysis_results.get("key_highlights", ""),
            model_used=analysis_results.get("model_used", ""),
            generated_at=datetime.utcnow(),
        )

        # Explicitly log what dates are being returned
        logger.info(
            f"analyze_integration_resource - Response period: start={response.period['start']}, end={response.period['end']}"
        )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle specific known errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Log and raise a generic error
        logger.error(f"Error analyzing channel: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing channel: {str(e)}",
        )


@router.get(
    "/{integration_id}/resources/{resource_id}/analyses",
    response_model=List[StoredAnalysisResponse],
    summary="Get stored channel analyses for a team integration resource",
    description="Retrieves previously run channel analyses for a Slack channel associated with a team integration.",
)
async def get_integration_resource_analyses(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    limit: int = Query(
        10, ge=1, le=100, description="Maximum number of analyses to return"
    ),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get stored channel analyses from the database for a team integration resource.

    Retrieves previously stored LLM analyses for a specific Slack channel, ordered by most recent first.
    """
    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel to ensure it exists and get the channel name
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        if not channel:
            # Try using the resource data directly
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found in database. Please run an analysis first.",
            )

        # Get the stored analyses
        analyses = await AnalysisStoreService.get_channel_analyses_for_channel(
            db=db, channel_id=str(channel.id), limit=limit, offset=offset
        )

        # Convert to response model
        response = []
        for analysis in analyses:
            response.append(
                StoredAnalysisResponse(
                    id=str(analysis.id),
                    channel_id=str(channel.id),
                    channel_name=channel.name,
                    start_date=analysis.start_date,
                    end_date=analysis.end_date,
                    message_count=analysis.message_count,
                    participant_count=analysis.participant_count,
                    thread_count=analysis.thread_count,
                    reaction_count=analysis.reaction_count,
                    channel_summary=analysis.channel_summary,
                    topic_analysis=analysis.topic_analysis,
                    contributor_insights=analysis.contributor_insights,
                    key_highlights=analysis.key_highlights,
                    model_used=analysis.model_used,
                    generated_at=analysis.generated_at,
                    workspace_id=str(
                        workspace.slack_id
                    ),  # Include workspace ID for user display
                )
            )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving stored analyses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving stored analyses: {str(e)}",
        )


@router.get(
    "/{integration_id}/resources/{resource_id}/analyses/latest",
    response_model=Optional[StoredAnalysisResponse],
    summary="Get latest channel analysis for a team integration resource",
    description="Retrieves the most recent channel analysis for a Slack channel associated with a team integration.",
)
async def get_latest_integration_resource_analysis(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get the most recent channel analysis from the database for a team integration resource.

    Retrieves the latest LLM analysis for a specific Slack channel.
    """
    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel to ensure it exists and get the channel name
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        if not channel:
            # Try using the resource data directly
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found in database. Please run an analysis first.",
            )

        # Get the latest analysis
        analysis = await AnalysisStoreService.get_latest_channel_analysis(
            db=db,
            channel_id=str(channel.id),
        )

        if not analysis:
            return None

        # Convert to response model
        return StoredAnalysisResponse(
            id=str(analysis.id),
            channel_id=str(channel.id),
            channel_name=channel.name,
            start_date=analysis.start_date,
            end_date=analysis.end_date,
            message_count=analysis.message_count,
            participant_count=analysis.participant_count,
            thread_count=analysis.thread_count,
            reaction_count=analysis.reaction_count,
            channel_summary=analysis.channel_summary,
            topic_analysis=analysis.topic_analysis,
            contributor_insights=analysis.contributor_insights,
            key_highlights=analysis.key_highlights,
            model_used=analysis.model_used,
            generated_at=analysis.generated_at,
            workspace_id=str(
                workspace.id
            ),  # Include database UUID as workspace_id for user display
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving latest analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving latest analysis: {str(e)}",
        )


@router.get(
    "/{integration_id}/resources/{resource_id}/analysis/{analysis_id}",
    response_model=StoredAnalysisResponse,
    summary="Get a specific channel analysis for a team integration resource",
    description="Retrieves a specific channel analysis by ID for a Slack channel associated with a team integration.",
)
async def get_integration_resource_analysis(
    integration_id: uuid.UUID,
    resource_id: uuid.UUID,
    analysis_id: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get a specific channel analysis by ID from the database.

    Retrieves a specific stored LLM analysis for a channel by its ID.
    """
    try:
        # Get the integration
        integration = await IntegrationService.get_integration(
            db=db,
            integration_id=integration_id,
            user_id=current_user["id"],
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found",
            )

        # Verify this is a Slack integration
        if integration.service_type != IntegrationType.SLACK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This operation is only supported for Slack integrations",
            )

        # Get the resource
        resource_stmt = await db.execute(
            select(ServiceResource).where(
                ServiceResource.id == resource_id,
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        resource = resource_stmt.scalar_one_or_none()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not a Slack channel",
            )

        # Get the workspace ID from the integration metadata
        metadata = integration.integration_metadata or {}
        slack_workspace_id = metadata.get("slack_id")

        if not slack_workspace_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integration has no associated Slack workspace",
            )

        # Get the workspace from the database
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == slack_workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slack workspace not found",
            )

        # Get the channel to ensure it exists
        channel_result = await db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalars().first()

        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found in database.",
            )

        # Get the analysis by its ID (which is now a proper UUID)
        real_analysis_id = None
        try:
            # Try to parse the analysis_id as a UUID
            uuid_obj = uuid.UUID(analysis_id)
            real_analysis_id = str(uuid_obj)
            logger.debug(f"Using analysis ID directly: {real_analysis_id}")
        except ValueError:
            # For backward compatibility with old format (analysis_{channel_id}_{timestamp})
            # Attempts to locate an analysis close to the provided timestamp
            logger.warning(f"Received legacy analysis ID format: {analysis_id}")
            parts = analysis_id.split("_")
            if len(parts) >= 3 and parts[0] == "analysis":
                # Try to extract timestamp
                timestamp_str = parts[-1]
                try:
                    # Convert timestamp to datetime
                    timestamp = int(timestamp_str)

                    # Find the analysis closest to this timestamp
                    stmt = (
                        select(ResourceAnalysis)
                        .where(ResourceAnalysis.resource_id == channel.id)
                        .order_by(
                            func.abs(
                                func.extract("epoch", ResourceAnalysis.analysis_generated_at)
                                - timestamp
                            )
                        )
                        .limit(1)
                    )

                    result = await db.execute(stmt)
                    analysis = result.scalar_one_or_none()

                    if analysis:
                        real_analysis_id = str(analysis.id)
                        logger.debug(f"Found analysis by timestamp: {real_analysis_id}")
                    else:
                        logger.warning(
                            f"No analysis found near timestamp {timestamp_str}"
                        )
                except (ValueError, TypeError):
                    logger.warning(
                        f"Could not parse timestamp from analysis_id: {analysis_id}"
                    )

            if not real_analysis_id:
                # As fallback, try to get the latest analysis
                logger.debug(
                    f"Using fallback to get latest analysis for channel {channel.id}"
                )
                # Get latest analysis for this resource from ResourceAnalysis
                from app.models.reports import ResourceAnalysis, AnalysisResourceType
                
                stmt = (
                    select(ResourceAnalysis)
                    .where(
                        ResourceAnalysis.resource_id == channel.id,
                        ResourceAnalysis.resource_type == AnalysisResourceType.SLACK_CHANNEL,
                    )
                    .order_by(ResourceAnalysis.analysis_generated_at.desc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                analysis = result.scalar_one_or_none()

                if analysis:
                    real_analysis_id = str(analysis.id)
                    logger.debug(
                        f"Using latest analysis as fallback: {real_analysis_id}"
                    )

        # If we couldn't extract an ID or find an analysis, return 404
        if not real_analysis_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found",
            )

        # Get the analysis by ID
        stmt = select(ResourceAnalysis).where(
            ResourceAnalysis.id == real_analysis_id
        )
        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()

        if not analysis:
            # Try getting it directly by the ID that was passed
            stmt = select(ResourceAnalysis).where(
                ResourceAnalysis.id == analysis_id
            )
            result = await db.execute(stmt)
            analysis = result.scalar_one_or_none()

            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Analysis not found",
                )

        # Return the analysis with the workspace_id included
        # Map ResourceAnalysis fields to StoredAnalysisResponse fields
        return StoredAnalysisResponse(
            id=str(analysis.id),
            channel_id=str(channel.id),
            channel_name=channel.name,
            start_date=analysis.period_start,
            end_date=analysis.period_end,
            # Get message count, participant count, thread count, and reaction count 
            # from the results JSON field if available
            message_count=analysis.results.get("message_count", 0) if analysis.results else 0,
            participant_count=analysis.results.get("participant_count", 0) if analysis.results else 0,
            thread_count=analysis.results.get("thread_count", 0) if analysis.results else 0,
            reaction_count=analysis.results.get("reaction_count", 0) if analysis.results else 0,
            # Map analysis text fields to response fields
            channel_summary=analysis.resource_summary,
            topic_analysis=analysis.topic_analysis,
            contributor_insights=analysis.contributor_insights,
            key_highlights=analysis.key_highlights,
            model_used=analysis.model_used,
            generated_at=analysis.analysis_generated_at,
            workspace_id=str(
                workspace.id
            ),  # Include database UUID as workspace_id for user display
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving analysis: {str(e)}",
        )
