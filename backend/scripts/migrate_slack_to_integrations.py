#!/usr/bin/env python3
"""
Migration script to convert existing SlackWorkspace instances to the new Integration model.

This script should be run after the new integration models have been created in the database.
It will:
1. Find all existing SlackWorkspace records
2. Create corresponding Integration, IntegrationCredential, and ServiceResource records
3. Link Slack resources to the new Integration model
4. Log all operations for verification

Usage:
    python migrate_slack_to_integrations.py

Environment variables:
    DATABASE_URL - The SQLAlchemy database URL
"""

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db.session import get_async_db_url
from app.models.integration import (
    CredentialType,
    Integration,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationStatus,
    IntegrationType,
    ResourceType,
    ServiceResource,
)
from app.models.slack import SlackChannel, SlackUser, SlackWorkspace
from app.models.team import Team

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("migrate_slack_integrations.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Create async engine and session
async_engine = create_async_engine(get_async_db_url(str(settings.DATABASE_URL)))
AsyncSessionLocal = sessionmaker(
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    bind=async_engine,
    expire_on_commit=False,
)


async def get_async_session():
    """Get an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def migrate_slack_workspace(db: AsyncSession, workspace: SlackWorkspace):
    """Migrate a single SlackWorkspace to the new Integration model."""
    logger.info(f"Migrating SlackWorkspace: {workspace.name} ({workspace.slack_id})")

    # Get the team for this workspace
    team = await db.get(Team, workspace.team_id)
    if not team:
        logger.error(f"Team not found for workspace {workspace.id}")
        return

    # Create Integration record
    integration = Integration(
        id=uuid.uuid4(),
        name=f"{workspace.name} Slack",
        description=f"Slack workspace for {workspace.name}",
        service_type=IntegrationType.SLACK,
        status=(
            IntegrationStatus.ACTIVE
            if workspace.is_connected
            else IntegrationStatus.DISCONNECTED
        ),
        integration_metadata={
            "slack_id": workspace.slack_id,
            "domain": workspace.domain,
            "icon_url": workspace.icon_url,
            "team_size": workspace.team_size,
            "original_workspace_id": str(workspace.id),
        },
        last_used_at=workspace.last_connected_at,
        owner_team_id=workspace.team_id,
        created_by_user_id=team.created_by_user_id,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )
    db.add(integration)
    await db.flush()

    # Create IntegrationCredential record if tokens exist
    if workspace.access_token:
        credential = IntegrationCredential(
            id=uuid.uuid4(),
            credential_type=CredentialType.OAUTH_TOKEN,
            encrypted_value=workspace.access_token,  # Assuming it's already encrypted
            expires_at=workspace.token_expires_at,
            refresh_token=workspace.refresh_token,  # Assuming it's already encrypted
            scopes={
                "scopes": ["channels:read", "users:read", "emoji:read"]
            },  # Default Slack scopes
            integration_id=integration.id,
            created_at=workspace.created_at,
            updated_at=workspace.updated_at,
        )
        db.add(credential)

    # Log the migration event
    event = IntegrationEvent(
        id=uuid.uuid4(),
        event_type="created",
        details={
            "migration": True,
            "original_workspace_id": str(workspace.id),
            "original_workspace_name": workspace.name,
        },
        integration_id=integration.id,
        actor_user_id=team.created_by_user_id,
        affected_team_id=workspace.team_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(event)

    # Migrate channels as resources
    channels = await db.execute(
        select(SlackChannel).where(SlackChannel.workspace_id == workspace.id)
    )
    for channel in channels.scalars().all():
        channel_resource = ServiceResource(
            id=uuid.uuid4(),
            resource_type=ResourceType.SLACK_CHANNEL,
            external_id=channel.slack_id,
            name=f"#{channel.name}",
            metadata={
                "type": channel.type,
                "purpose": channel.purpose,
                "topic": channel.topic,
                "member_count": channel.member_count,
                "is_archived": channel.is_archived,
                "created_at_ts": channel.created_at_ts,
                "original_channel_id": str(channel.id),
            },
            last_synced_at=channel.last_sync_at,
            integration_id=integration.id,
            created_at=channel.created_at,
            updated_at=channel.updated_at,
        )
        db.add(channel_resource)

    # Migrate users as resources
    users = await db.execute(
        select(SlackUser).where(SlackUser.workspace_id == workspace.id)
    )
    for user in users.scalars().all():
        user_resource = ServiceResource(
            id=uuid.uuid4(),
            resource_type=ResourceType.SLACK_USER,
            external_id=user.slack_id,
            name=user.real_name or user.name,
            metadata={
                "name": user.name,
                "display_name": user.display_name,
                "real_name": user.real_name,
                "email": user.email,
                "title": user.title,
                "profile_image_url": user.profile_image_url,
                "is_bot": user.is_bot,
                "is_admin": user.is_admin,
                "original_user_id": str(user.id),
            },
            integration_id=integration.id,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        db.add(user_resource)

    # Return the new integration ID
    return integration.id


async def run_migration():
    """Execute the migration process."""
    logger.info("Starting Slack to Integration migration...")

    # Get count of SlackWorkspace records
    async for db in get_async_session():
        workspaces_result = await db.execute(select(SlackWorkspace))
        workspaces = workspaces_result.scalars().all()

        if not workspaces:
            logger.info("No SlackWorkspace records found to migrate")
            return

        logger.info(f"Found {len(workspaces)} SlackWorkspace records to migrate")

        # Process each workspace
        for workspace in workspaces:
            try:
                integration_id = await migrate_slack_workspace(db, workspace)
                logger.info(
                    f"Successfully migrated workspace {workspace.name} to integration {integration_id}"
                )
            except Exception as e:
                logger.error(
                    f"Error migrating workspace {workspace.id}: {str(e)}", exc_info=True
                )
                await db.rollback()
                continue

        # Commit all changes
        await db.commit()
        logger.info("Migration completed successfully")


if __name__ == "__main__":
    asyncio.run(run_migration())
