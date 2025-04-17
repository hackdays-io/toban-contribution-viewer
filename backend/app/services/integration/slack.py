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
    async def create_from_oauth(
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
        Create a Slack integration from an OAuth authorization code.

        This method exchanges the auth code for tokens, gets workspace info,
        and creates the integration record.

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
        # Exchange auth code for tokens using temporary API client without token
        # We'll create a proper client after getting the token
        slack_api = SlackApiClient(
            access_token="temporary"
        )  # Token will be replaced by exchange_code
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
        
        # Extract team info directly from the OAuth response instead of calling get_workspace_info
        # This is more reliable since the team info is already included in the OAuth response
        workspace_info = {
            "team": oauth_response.get("team", {})
        }
        
        # Log the workspace info for debugging
        logger.info(f"Workspace info from OAuth response: {workspace_info}")
        
        if not workspace_info or "team" not in workspace_info or not workspace_info["team"]:
            # Fall back to get_workspace_info only if team info is missing from OAuth response
            try:
                logger.info("Team info missing from OAuth response, falling back to get_workspace_info")
                workspace_info = await slack_api.get_workspace_info()
                logger.info(f"Workspace info from API: {workspace_info}")
            except Exception as e:
                logger.error(f"Error getting workspace info: {str(e)}")
                raise ValueError(f"Failed to get workspace information: {str(e)}")
                
        if not workspace_info or "team" not in workspace_info or not workspace_info["team"]:
            raise ValueError("Failed to get workspace information: No team data available")

        # Create integration name if not provided
        if not name:
            name = f"{workspace_info['team']['name']} Slack"

        # Create the integration
        integration = await IntegrationService.create_integration(
            db=db,
            team_id=team_id,
            user_id=user_id,
            name=name,
            service_type=IntegrationType.SLACK,
            description=description,
            metadata={
                "slack_id": workspace_info["team"]["id"],
                "domain": workspace_info["team"].get("domain"),
                "name": workspace_info["team"]["name"],
                "icon_url": workspace_info["team"].get("icon", {}).get("image_132"),
                "bot_user_id": oauth_response.get("bot_user_id"),
                "scope": oauth_response.get("scope", ""),
                "authed_user": oauth_response.get("authed_user", {}),
            },
            credential_data={
                "credential_type": CredentialType.OAUTH_TOKEN,
                "encrypted_value": oauth_response[
                    "access_token"
                ],  # This should be encrypted in production
                "refresh_token": oauth_response.get(
                    "refresh_token"
                ),  # This should be encrypted in production
                "expires_at": (
                    datetime.utcnow()
                    + timedelta(seconds=oauth_response.get("expires_in", 86400))
                    if "expires_in" in oauth_response
                    else None
                ),
                "scopes": oauth_response.get("scope", "").split(","),
            },
        )

        # Verify token was saved properly
        saved_token = await SlackIntegrationService.get_token(db, integration.id)
        if not saved_token:
            logger.error(f"Token was not properly saved for integration {integration.id}")
            raise ValueError("Token was not properly saved for the integration")
        
        logger.info(f"Token was successfully saved for integration {integration.id}, length: {len(saved_token)}")
            
        try:
            # Only sync channels for now, omit user sync
            logger.info(f"Syncing channels for integration {integration.id}")
            await SlackIntegrationService.sync_channels(db, integration.id)
            # Note: User sync is omitted to avoid potential errors
            logger.info(f"Channel sync complete. User sync omitted on initial creation.")
        except Exception as e:
            logger.error(f"Error syncing channels: {str(e)}", exc_info=True)
            # Continue instead of failing - we can sync resources later
            
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
        try:
            logger.info(f"Getting token for integration: {integration_id}")
            
            # First, verify the integration exists
            integration = await db.get(Integration, integration_id)
            if not integration:
                logger.error(f"Integration {integration_id} not found")
                return None
                
            # Query the credential
            query = select(IntegrationCredential).where(
                IntegrationCredential.integration_id == integration_id,
                IntegrationCredential.credential_type == CredentialType.OAUTH_TOKEN,
            )
            
            logger.info(f"Executing query for credentials: {query}")
            result = await db.execute(query)
            credential = result.scalar_one_or_none()

            if not credential:
                logger.error(f"No credential found for integration {integration_id}")
                return None
                
            logger.info(f"Found credential with ID: {credential.id}")
            
            if not credential.encrypted_value:
                logger.error(f"Credential found but has no encrypted_value for integration {integration_id}")
                return None

            # Log token length for debugging
            token_length = len(credential.encrypted_value) if credential.encrypted_value else 0
            logger.info(f"Retrieved token with length: {token_length}")
                
            return credential.encrypted_value  # In production, this would be decrypted
            
        except Exception as e:
            logger.error(f"Error getting token for integration {integration_id}: {str(e)}", exc_info=True)
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
        if not integration:
            logger.error(f"Integration {integration_id} not found")
            raise ValueError(f"Integration {integration_id} not found")
            
        if integration.service_type != IntegrationType.SLACK:
            logger.error(f"Integration {integration_id} is not a Slack integration (type: {integration.service_type})")
            raise ValueError(f"Integration {integration_id} is not a Slack integration")

        # Get the access token
        token = await SlackIntegrationService.get_token(db, integration_id)
        if not token:
            logger.error(f"No access token found for integration {integration_id}")
            
            # Check if credential exists at all
            result = await db.execute(
                select(IntegrationCredential).where(
                    IntegrationCredential.integration_id == integration_id,
                )
            )
            any_credentials = result.scalars().all()
            
            if not any_credentials:
                logger.error(f"No credentials of any type found for integration {integration_id}")
                raise ValueError(f"No credentials found for integration {integration_id}")
            else:
                cred_types = [cred.credential_type for cred in any_credentials]
                logger.error(f"Found {len(any_credentials)} credentials but none with OAuth token. Types: {cred_types}")
                
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
        if not integration:
            logger.error(f"Integration {integration_id} not found")
            raise ValueError(f"Integration {integration_id} not found")
            
        if integration.service_type != IntegrationType.SLACK:
            logger.error(f"Integration {integration_id} is not a Slack integration (type: {integration.service_type})")
            raise ValueError(f"Integration {integration_id} is not a Slack integration")

        # Get the access token
        token = await SlackIntegrationService.get_token(db, integration_id)
        if not token:
            logger.error(f"No access token found for integration {integration_id}")
            
            # Check if credential exists at all
            result = await db.execute(
                select(IntegrationCredential).where(
                    IntegrationCredential.integration_id == integration_id,
                )
            )
            any_credentials = result.scalars().all()
            
            if not any_credentials:
                logger.error(f"No credentials of any type found for integration {integration_id}")
                raise ValueError(f"No credentials found for integration {integration_id}")
            else:
                cred_types = [cred.credential_type for cred in any_credentials]
                logger.error(f"Found {len(any_credentials)} credentials but none with OAuth token. Types: {cred_types}")
                
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
