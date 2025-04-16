"""
API endpoints for integration management.
"""

import logging
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.integration.schemas import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationShareCreate,
    IntegrationShareResponse,
    IntegrationTypeEnum,
    IntegrationUpdate,
    ManualSlackIntegrationCreate,
    ResourceAccessCreate,
    ResourceAccessResponse,
    ServiceResourceResponse,
    SlackIntegrationCreate,
    TeamInfo,
    UserInfo,
)
from app.core.auth import get_current_user
from app.db.session import get_async_db
from app.models.integration import AccessLevel, CredentialType, IntegrationType, ServiceResource, ShareLevel
from app.services.integration.base import IntegrationService
from app.services.integration.slack import SlackIntegrationService
from app.services.team.permissions import has_team_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def prepare_integration_response(integration) -> IntegrationResponse:
    """
    Converts an Integration model to an IntegrationResponse schema.
    Handles the field mappings and makes sure all required fields are present.
    """
    # Create the owner_team object
    owner_team = TeamInfo(
        id=integration.owner_team.id,
        name=integration.owner_team.name,
        slug=integration.owner_team.slug,
    )

    # Create the created_by object - this was previously missing
    created_by = UserInfo(id=integration.created_by_user_id)

    # Convert integration_metadata to metadata and ensure it's a dict
    metadata = (
        integration.integration_metadata
        if integration.integration_metadata is not None
        else {}
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
        # These will be handled automatically by Pydantic's ORM mode
        credentials=integration.credentials,
        resources=integration.resources,
        shared_with=integration.shared_with,
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

    # Create the integration
    new_integration = await IntegrationService.create_integration(
        db=db,
        team_id=integration.team_id,
        user_id=current_user["id"],
        name=integration.name,
        service_type=IntegrationType(integration.service_type.value),
        description=integration.description,
    )

    # Commit the transaction
    await db.commit()

    return prepare_integration_response(new_integration)


@router.post(
    "/slack", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED
)
async def create_slack_integration(
    integration: SlackIntegrationCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new Slack integration via OAuth.

    Args:
        integration: Slack integration data including OAuth code
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

    try:
        # Client ID and secret are now provided by the user through the UI
        # These values should always be present in the request
        client_id = integration.client_id
        client_secret = integration.client_secret

        if not client_id or not client_secret:
            raise ValueError("Slack client ID and client secret are required")

        # Create the integration using the OAuth flow
        new_integration, _ = await SlackIntegrationService.create_from_oauth(
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

        # Commit the transaction
        await db.commit()

        return prepare_integration_response(new_integration)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error creating Slack integration: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the integration",
        )


@router.post(
    "/slack/manual",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manual_slack_integration(
    integration: ManualSlackIntegrationCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new Slack integration with manually provided credentials.

    This endpoint allows creating a Slack integration without going through the OAuth flow,
    by directly providing the client ID, client secret, and bot token.

    Args:
        integration: Slack integration data including credentials
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

    try:
        # Create the integration with the manual credentials
        new_integration = await IntegrationService.create_integration(
            db=db,
            team_id=integration.team_id,
            user_id=current_user["id"],
            name=integration.name,
            service_type=IntegrationType.SLACK,
            description=integration.description,
            metadata={
                "manually_configured": True,
                "client_id": integration.credentials.client_id,
            },
            credential_data={
                "credential_type": CredentialType.OAUTH_TOKEN,
                "encrypted_value": integration.credentials.bot_token,  # This should be encrypted in production
                "client_id": integration.credentials.client_id,
                "client_secret": integration.credentials.client_secret,  # This should be encrypted in production
            },
        )

        # Commit the transaction
        await db.commit()

        return prepare_integration_response(new_integration)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            f"Error creating manual Slack integration: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the integration",
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

    return resources


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
            # For demonstration purposes, return mock data when the token is missing
            # This would allow the frontend to function without a real Slack token
            try:
                # First try to sync with the database token
                channels = await SlackIntegrationService.sync_channels(
                    db=db,
                    integration_id=integration_id,
                )

                users = await SlackIntegrationService.sync_users(
                    db=db,
                    integration_id=integration_id,
                )

                # Commit the transaction
                await db.commit()
            except ValueError as e:
                # For all ValueError types, re-raise
                raise

            return {
                "status": "success",
                "message": "Resources synced successfully",
                "synced": {
                    "channels": len(channels),
                    "users": len(users),
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
