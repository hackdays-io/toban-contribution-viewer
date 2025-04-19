"""
Slack integration service.

This module provides Slack-specific integration functionality, including
OAuth flow handling, user/channel resource management, and API operations.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import (
    CredentialType,
    Integration,
    IntegrationCredential,
    IntegrationStatus,
    IntegrationType,
    ResourceType,
    ServiceResource,
)
from app.services.integration.base import IntegrationService
from app.services.slack.api import SlackApiClient

logger = logging.getLogger(__name__)


class SlackIntegrationService(IntegrationService):
    """
    Service for managing Slack integrations.

    This class extends the base IntegrationService with Slack-specific
    functionality including OAuth flow, channel syncing, and user management.
    """

    @staticmethod
    async def handle_oauth_flow(
        db: AsyncSession,
        team_id: uuid.UUID,
        user_id: str,
        auth_code: str,
        redirect_uri: str,
        client_id: str,
        client_secret: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[Integration, Dict]:
        """
        Process Slack OAuth flow and create or update an integration.

        This method exchanges the auth code for tokens, gets workspace info,
        and then uses the base IntegrationService to create or update the integration.

        Args:
            db: Database session
            team_id: UUID of the team that will own the integration
            user_id: ID of the user creating the integration
            auth_code: OAuth authorization code
            redirect_uri: OAuth redirect URI
            client_id: Slack client ID
            client_secret: Slack client secret
            name: Optional name for the integration (defaults to workspace name)
            description: Optional description

        Returns:
            Tuple of (Integration, workspace_info)
        """
        # Exchange auth code for tokens using temporary API client
        slack_api = SlackApiClient(access_token="temporary")
        oauth_response = await slack_api.exchange_code(
            code=auth_code,
            redirect_uri=redirect_uri,
            client_id=client_id,
            client_secret=client_secret,
        )

        if not oauth_response or "access_token" not in oauth_response:
            raise ValueError("Failed to exchange auth code for tokens")

        # Get workspace info with proper token
        slack_api = SlackApiClient(access_token=oauth_response["access_token"])
        workspace_info = await slack_api.get_workspace_info()

        if not workspace_info or "team" not in workspace_info:
            raise ValueError("Failed to get workspace information")

        # Extract workspace ID
        workspace_id = workspace_info["team"]["id"]
        if not workspace_id:
            raise ValueError("No team ID in Slack workspace information")

        # Create integration name if not provided
        if not name:
            name = f"{workspace_info['team']['name']} Slack"

        # Prepare metadata and credential data
        metadata = {
            "slack_id": workspace_id,  # Keep this for backward compatibility
            "domain": workspace_info["team"].get("domain"),
            "name": workspace_info["team"]["name"],
            "icon_url": workspace_info["team"].get("icon", {}).get("image_132"),
            "bot_user_id": oauth_response.get("bot_user_id"),
            "scope": oauth_response.get("scope", ""),
            "authed_user": oauth_response.get("authed_user", {}),
        }

        credential_data = {
            "credential_type": CredentialType.OAUTH_TOKEN,
            "encrypted_value": oauth_response["access_token"],
            "refresh_token": oauth_response.get("refresh_token"),
            "expires_at": (
                datetime.utcnow()
                + timedelta(seconds=oauth_response.get("expires_in", 86400))
                if "expires_in" in oauth_response
                else None
            ),
            "scopes": oauth_response.get("scope", "").split(","),
        }

        # Use the base service to create or update the integration
        # This will handle the uniqueness constraint and update existing integrations
        integration = await IntegrationService.create_integration(
            db=db,
            team_id=team_id,
            user_id=user_id,
            name=name,
            service_type=IntegrationType.SLACK,
            description=description,
            workspace_id=workspace_id,
            metadata=metadata,
            credential_data=credential_data,
        )

        # Sync channels and users with the new token
        # These could be moved to background tasks later
        await SlackIntegrationService.sync_channels(db, integration.id)
        await SlackIntegrationService.sync_users(db, integration.id)

        return integration, workspace_info

    @staticmethod
    async def get_token(db: AsyncSession, integration_id: uuid.UUID) -> Optional[str]:
        """
        Get the access token for a Slack integration.

        Args:
            db: Database session
            integration_id: UUID of the integration

        Returns:
            Access token if found, None otherwise
        """
        # First try to get token from credentials table
        result = await db.execute(
            select(IntegrationCredential).where(
                IntegrationCredential.integration_id == integration_id,
                IntegrationCredential.credential_type == CredentialType.OAUTH_TOKEN,
            )
        )
        credential = result.scalar_one_or_none()

        if credential and credential.encrypted_value:
            return credential.encrypted_value  # In production, this would be decrypted
        
        # If not found in credentials, check metadata (for backward compatibility)
        integration_result = await db.execute(
            select(Integration).where(
                Integration.id == integration_id
            )
        )
        integration = integration_result.scalar_one_or_none()
        
        if integration and integration.integration_metadata:
            metadata = integration.integration_metadata
            if metadata.get("access_token"):
                return metadata["access_token"]
        
        return None

    @staticmethod
    async def sync_channels(
        db: AsyncSession,
        integration_id: uuid.UUID,
        limit: int = 1000,
    ) -> List[ServiceResource]:
        """
        Sync channels for a Slack integration.

        Args:
            db: Database session
            integration_id: UUID of the integration
            limit: Maximum number of channels to sync

        Returns:
            List of synchronized channel resources
        """
        # Get the integration
        integration = await db.get(Integration, integration_id)
        if not integration or integration.service_type != IntegrationType.SLACK:
            raise ValueError("Invalid Slack integration ID")

        # Get the access token
        token = await SlackIntegrationService.get_token(db, integration_id)
        if not token:
            raise ValueError("No access token found for integration")

        # Get channels from Slack API
        slack_api = SlackApiClient(access_token=token)
        channels = await slack_api.get_all_channels(limit=limit)

        # Get existing channel resources
        result = await db.execute(
            select(ServiceResource).where(
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
            )
        )
        existing_resources = {r.external_id: r for r in result.scalars().all()}

        # Create or update channel resources
        new_resources = []
        for channel in channels:
            resource_data = {
                "name": f"#{channel['name']}",
                "resource_metadata": {
                    "type": channel.get("is_private", False) and "private" or "public",
                    "purpose": channel.get("purpose", {}).get("value"),
                    "topic": channel.get("topic", {}).get("value"),
                    "member_count": channel.get("num_members"),
                    "is_archived": channel.get("is_archived", False),
                    "created": channel.get("created"),
                },
                "last_synced_at": datetime.utcnow(),
            }

            if channel["id"] in existing_resources:
                # Update existing resource
                resource = existing_resources[channel["id"]]
                resource.name = resource_data["name"]
                resource.resource_metadata = resource_data["resource_metadata"]
                resource.last_synced_at = resource_data["last_synced_at"]
            else:
                # Create new resource
                resource = ServiceResource(
                    id=uuid.uuid4(),
                    integration_id=integration_id,
                    resource_type=ResourceType.SLACK_CHANNEL,
                    external_id=channel["id"],
                    **resource_data,
                )
                db.add(resource)
                new_resources.append(resource)

        # Update last_used_at for the integration
        integration.last_used_at = datetime.utcnow()

        # Return all synchronized resources
        return list(existing_resources.values()) + new_resources

    @staticmethod
    async def sync_users(
        db: AsyncSession,
        integration_id: uuid.UUID,
        limit: int = 1000,
    ) -> List[ServiceResource]:
        """
        Sync users for a Slack integration.

        Args:
            db: Database session
            integration_id: UUID of the integration
            limit: Maximum number of users to sync

        Returns:
            List of synchronized user resources
        """
        # Get the integration
        integration = await db.get(Integration, integration_id)
        if not integration or integration.service_type != IntegrationType.SLACK:
            raise ValueError("Invalid Slack integration ID")

        # Get the access token
        token = await SlackIntegrationService.get_token(db, integration_id)
        if not token:
            raise ValueError("No access token found for integration")

        # Get users from Slack API
        slack_api = SlackApiClient(access_token=token)
        users = await slack_api.get_all_users(limit=limit)

        # Get existing user resources
        result = await db.execute(
            select(ServiceResource).where(
                ServiceResource.integration_id == integration_id,
                ServiceResource.resource_type == ResourceType.SLACK_USER,
            )
        )
        existing_resources = {r.external_id: r for r in result.scalars().all()}

        # Create or update user resources
        new_resources = []
        for user in users:
            # Skip bots and deactivated users by default
            if user.get("is_bot", False) or user.get("deleted", False):
                continue

            profile = user.get("profile", {})
            resource_data = {
                "name": profile.get("real_name") or user.get("name", "Unknown User"),
                "resource_metadata": {
                    "name": user.get("name"),
                    "real_name": profile.get("real_name"),
                    "display_name": profile.get("display_name"),
                    "email": profile.get("email"),
                    "title": profile.get("title"),
                    "phone": profile.get("phone"),
                    "image_24": profile.get("image_24"),
                    "image_48": profile.get("image_48"),
                    "image_72": profile.get("image_72"),
                    "status_text": profile.get("status_text"),
                    "status_emoji": profile.get("status_emoji"),
                    "is_admin": user.get("is_admin", False),
                    "is_owner": user.get("is_owner", False),
                },
                "last_synced_at": datetime.utcnow(),
            }

            if user["id"] in existing_resources:
                # Update existing resource
                resource = existing_resources[user["id"]]
                resource.name = resource_data["name"]
                resource.resource_metadata = resource_data["resource_metadata"]
                resource.last_synced_at = resource_data["last_synced_at"]
            else:
                # Create new resource
                resource = ServiceResource(
                    id=uuid.uuid4(),
                    integration_id=integration_id,
                    resource_type=ResourceType.SLACK_USER,
                    external_id=user["id"],
                    **resource_data,
                )
                db.add(resource)
                new_resources.append(resource)

        # Update last_used_at for the integration
        integration.last_used_at = datetime.utcnow()

        # Return all synchronized resources
        return list(existing_resources.values()) + new_resources
