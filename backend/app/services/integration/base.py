"""
Base service for integration management.

This module provides common functions for working with integrations, including
creating, updating, and sharing integrations between teams.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.integration import (
    AccessLevel,
    EventType,
    Integration,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationShare,
    IntegrationStatus,
    IntegrationType,
    ResourceAccess,
    ServiceResource,
    ShareLevel,
)
from app.models.team import Team

logger = logging.getLogger(__name__)


class IntegrationService:
    """
    Base service for managing integrations.

    This class provides methods for creating, updating, sharing, and
    managing integrations with external services.
    """

    @staticmethod
    async def get_integration(
        db: AsyncSession, integration_id: uuid.UUID, user_id: str
    ) -> Optional[Integration]:
        """
        Get an integration by ID.

        Args:
            db: Database session
            integration_id: UUID of the integration to retrieve
            user_id: ID of the user making the request

        Returns:
            Integration object if found, None otherwise
        """
        # Get the integration with eager loading of relationships
        stmt = (
            select(Integration)
            .where(Integration.id == integration_id)
            .options(
                selectinload(Integration.owner_team),
                selectinload(Integration.credentials),
                selectinload(Integration.shared_with),
                selectinload(Integration.resources),
                selectinload(Integration.events),
            )
        )
        result = await db.execute(stmt)
        integration = result.scalar_one_or_none()

        if not integration:
            return None

        # Get the teams the user is a member of
        result = await db.execute(
            select(Team).join(Team.members).where(Team.members.any(user_id=user_id))
        )
        user_teams = result.scalars().all()
        user_team_ids = [team.id for team in user_teams]

        # Check if user has access to this integration
        if integration.owner_team_id in user_team_ids:
            return integration

        # Check if integration is shared with user's teams
        result = await db.execute(
            select(IntegrationShare).where(
                IntegrationShare.integration_id == integration_id,
                IntegrationShare.team_id.in_(user_team_ids),
                IntegrationShare.status == "active",
            )
        )
        shares = result.scalars().all()

        if shares:
            return integration

        return None

    @staticmethod
    async def get_team_integrations(
        db: AsyncSession,
        team_id: uuid.UUID,
        include_shared: bool = True,
        service_type: Optional[IntegrationType] = None,
    ) -> List[Integration]:
        """
        Get all integrations available to a team.

        Args:
            db: Database session
            team_id: UUID of the team
            include_shared: Whether to include integrations shared with this team
            service_type: Filter by service type

        Returns:
            List of Integration objects
        """
        # Build the query for owned integrations with eager loading
        query = (
            select(Integration)
            .where(Integration.owner_team_id == team_id)
            .options(
                selectinload(Integration.owner_team),
                selectinload(Integration.credentials),
                selectinload(Integration.shared_with),
                selectinload(Integration.resources),
                selectinload(Integration.events),
            )
        )

        # Add service type filter if provided
        if service_type:
            query = query.where(Integration.service_type == service_type)

        # Execute the query
        result = await db.execute(query)
        owned_integrations = result.scalars().all()

        # Get shared integrations if requested
        if include_shared:
            # Get integrations shared with this team
            shared_query = (
                select(Integration)
                .join(
                    IntegrationShare, Integration.id == IntegrationShare.integration_id
                )
                .where(
                    IntegrationShare.team_id == team_id,
                    IntegrationShare.status == "active",
                )
                .options(
                    selectinload(Integration.owner_team),
                    selectinload(Integration.credentials),
                    selectinload(Integration.shared_with),
                    selectinload(Integration.resources),
                    selectinload(Integration.events),
                )
            )

            # Add service type filter if provided
            if service_type:
                shared_query = shared_query.where(
                    Integration.service_type == service_type
                )

            # Execute the query
            result = await db.execute(shared_query)
            shared_integrations = result.scalars().all()

            # Combine the results, ensuring no duplicates
            owned_ids = {i.id for i in owned_integrations}
            all_integrations = owned_integrations + [
                i for i in shared_integrations if i.id not in owned_ids
            ]
            return all_integrations

        return owned_integrations

    @staticmethod
    async def find_integration_by_workspace_id(
        db: AsyncSession,
        team_id: uuid.UUID,
        workspace_id: str,
        service_type: IntegrationType,
    ) -> Optional[Integration]:
        """
        Find an existing integration by team, workspace ID, and service type.

        Args:
            db: Database session
            team_id: UUID of the team
            workspace_id: External workspace ID to search for
            service_type: Type of service (Slack, GitHub, etc.)

        Returns:
            Integration object if found, None otherwise
        """
        # First try to find by direct workspace_id field
        query = select(Integration).where(
            Integration.owner_team_id == team_id,
            Integration.service_type == service_type,
            Integration.workspace_id == workspace_id,
        )

        result = await db.execute(query)
        integration = result.scalar_one_or_none()

        if integration:
            return integration

        # Fall back to searching in metadata for backward compatibility
        query = select(Integration).where(
            Integration.owner_team_id == team_id,
            Integration.service_type == service_type,
        )

        result = await db.execute(query)
        integrations = result.scalars().all()

        # Search through metadata for workspace_id match
        for integration in integrations:
            metadata = integration.integration_metadata or {}
            # Check for service-specific IDs in metadata
            service_id_key = f"{service_type.value.lower()}_id"
            if (
                metadata.get(service_id_key) == workspace_id
                or metadata.get("slack_id") == workspace_id
            ):
                # Update the workspace_id field for future queries
                integration.workspace_id = workspace_id
                return integration

        return None

    @staticmethod
    async def update_existing_integration(
        db: AsyncSession,
        integration: Integration,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict] = None,
        credential_data: Optional[Dict] = None,
    ) -> Integration:
        """
        Update an existing integration with new data.

        Args:
            db: Database session
            integration: Existing integration to update
            user_id: ID of the user updating the integration
            name: New name (optional)
            description: New description (optional)
            metadata: New metadata to merge with existing (optional)
            credential_data: New credential data (optional)

        Returns:
            Updated Integration object
        """
        # Update basic fields if provided
        if name:
            integration.name = name

        if description:
            integration.description = description

        # Merge with existing metadata instead of replacing
        if metadata:
            integration.integration_metadata = {
                **(integration.integration_metadata or {}),
                **metadata,
                "last_updated_by": user_id,
                "last_updated_at": datetime.utcnow().isoformat(),
            }

        # Update credentials if provided
        if credential_data:
            # Find existing credential
            result = await db.execute(
                select(IntegrationCredential).where(
                    IntegrationCredential.integration_id == integration.id,
                    IntegrationCredential.credential_type
                    == credential_data.get("credential_type"),
                )
            )
            credential = result.scalar_one_or_none()

            if credential:
                # Update existing credential
                if "encrypted_value" in credential_data:
                    credential.encrypted_value = credential_data.get("encrypted_value")
                if "refresh_token" in credential_data:
                    credential.refresh_token = credential_data.get("refresh_token")
                if "expires_at" in credential_data:
                    credential.expires_at = credential_data.get("expires_at")
                if "scopes" in credential_data:
                    credential.scopes = credential_data.get("scopes")
            else:
                # Create new credential
                credential = IntegrationCredential(
                    id=uuid.uuid4(),
                    integration_id=integration.id,
                    credential_type=credential_data.get("credential_type"),
                    encrypted_value=credential_data.get("encrypted_value"),
                    refresh_token=credential_data.get("refresh_token"),
                    expires_at=credential_data.get("expires_at"),
                    scopes=credential_data.get("scopes"),
                )
                db.add(credential)

        # Update status to ACTIVE in case it was previously disconnected
        integration.status = IntegrationStatus.ACTIVE

        # Update last_used_at
        integration.last_used_at = datetime.utcnow()

        # Record the update event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=integration.id,
            event_type=EventType.UPDATED,
            actor_user_id=user_id,
            affected_team_id=integration.owner_team_id,
            details={
                "updated_fields": {
                    "name": name is not None,
                    "description": description is not None,
                    "metadata": metadata is not None,
                    "credentials": credential_data is not None,
                },
            },
        )
        db.add(event)

        # Add an updated flag to indicate this was an existing integration that was updated
        # We need to add this to the SQLAlchemy model's __dict__ since it's not a regular column
        # This will be available when the object is returned but won't be stored in the database
        integration.__dict__["updated"] = True

        return integration

    @staticmethod
    async def create_integration(
        db: AsyncSession,
        team_id: uuid.UUID,
        user_id: str,
        name: str,
        service_type: IntegrationType,
        description: Optional[str] = None,
        workspace_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        credential_data: Optional[Dict] = None,
    ) -> Integration:
        """
        Create or update an integration with uniqueness constraint handling.

        If an integration with the same team_id, workspace_id, and service_type
        already exists, it will be updated instead of creating a new one.

        Args:
            db: Database session
            team_id: UUID of the team that will own the integration
            user_id: ID of the user creating the integration
            name: Name of the integration
            service_type: Type of service (Slack, GitHub, etc.)
            description: Optional description
            workspace_id: Optional external workspace identifier for uniqueness constraints
            metadata: Service-specific metadata
            credential_data: Optional credential data

        Returns:
            Created or updated Integration object
        """
        # If workspace_id is provided, check for existing integration
        if workspace_id:
            existing_integration = (
                await IntegrationService.find_integration_by_workspace_id(
                    db, team_id, workspace_id, service_type
                )
            )

            if existing_integration:
                # Update existing integration
                logger.info(
                    f"Found existing {service_type.value} integration for team {team_id} "
                    f"with workspace_id {workspace_id}, updating instead of creating new"
                )
                return await IntegrationService.update_existing_integration(
                    db=db,
                    integration=existing_integration,
                    user_id=user_id,
                    name=name,
                    description=description,
                    metadata=metadata,
                    credential_data=credential_data,
                )

        # Create a new integration if none exists or workspace_id is not provided
        integration = Integration(
            id=uuid.uuid4(),
            name=name,
            description=description,
            service_type=service_type,
            status=IntegrationStatus.ACTIVE,
            integration_metadata=metadata or {},
            workspace_id=workspace_id,
            owner_team_id=team_id,
            created_by_user_id=user_id,
            last_used_at=datetime.utcnow(),
        )
        db.add(integration)
        await db.flush()

        # Create credential if provided
        if credential_data:
            credential = IntegrationCredential(
                id=uuid.uuid4(),
                integration_id=integration.id,
                credential_type=credential_data.get("credential_type"),
                encrypted_value=credential_data.get("encrypted_value"),
                expires_at=credential_data.get("expires_at"),
                refresh_token=credential_data.get("refresh_token"),
                scopes=credential_data.get("scopes"),
            )
            db.add(credential)

        # Mark as a new integration (not updated)
        integration.__dict__["updated"] = False

        # Record creation event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=integration.id,
            event_type=EventType.CREATED,
            actor_user_id=user_id,
            affected_team_id=team_id,
            details={
                "service_type": service_type,
                "name": name,
            },
        )
        db.add(event)

        # Eagerly load the owner_team to prevent MissingGreenlet errors
        # when the relationship is accessed in an async context
        stmt = (
            select(Integration).where(Integration.id == integration.id)
            # No need to filter by status here since we just created this integration
            .options(
                selectinload(Integration.owner_team),
                selectinload(Integration.credentials),
                selectinload(Integration.shared_with),
                selectinload(Integration.resources),
                selectinload(Integration.events),
            )
        )
        result = await db.execute(stmt)
        integration_with_relations = result.scalar_one_or_none()

        # Return the integration with all relationships loaded
        return integration_with_relations or integration

    @staticmethod
    async def update_integration(
        db: AsyncSession,
        integration_id: uuid.UUID,
        user_id: str,
        data: Dict,
    ) -> Optional[Integration]:
        """
        Update an existing integration.

        Args:
            db: Database session
            integration_id: UUID of the integration to update
            user_id: ID of the user making the update
            data: Dictionary of fields to update

        Returns:
            Updated Integration object if successful, None otherwise
        """
        # Get the integration with eager loading of relationships
        stmt = (
            select(Integration)
            .where(Integration.id == integration_id)
            .options(
                selectinload(Integration.owner_team),
                selectinload(Integration.credentials),
                selectinload(Integration.shared_with),
                selectinload(Integration.resources),
                selectinload(Integration.events),
            )
        )
        result = await db.execute(stmt)
        integration = result.scalar_one_or_none()

        if not integration:
            return None

        # Record original values for logging
        original_values = {
            "name": integration.name,
            "description": integration.description,
            "status": integration.status,
            "integration_metadata": integration.integration_metadata,
        }

        # Update allowed fields
        if "name" in data:
            integration.name = data["name"]

        if "description" in data:
            integration.description = data["description"]

        if "status" in data:
            integration.status = data["status"]

        if "integration_metadata" in data:
            # Merge with existing metadata instead of replacing
            integration.integration_metadata = {
                **(integration.integration_metadata or {}),
                **data["integration_metadata"],
            }

        # Record the update event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=integration.id,
            event_type=EventType.UPDATED,
            actor_user_id=user_id,
            affected_team_id=integration.owner_team_id,
            details={
                "previous": original_values,
                "updated": {k: v for k, v in data.items() if k in original_values},
            },
        )
        db.add(event)

        return integration

    @staticmethod
    async def share_integration(
        db: AsyncSession,
        integration_id: uuid.UUID,
        team_id: uuid.UUID,
        user_id: str,
        share_level: ShareLevel = ShareLevel.READ_ONLY,
    ) -> Optional[IntegrationShare]:
        """
        Share an integration with another team.

        Args:
            db: Database session
            integration_id: UUID of the integration to share
            team_id: UUID of the team to share with
            user_id: ID of the user sharing the integration
            share_level: Level of access to grant

        Returns:
            IntegrationShare object if successful, None otherwise
        """
        # Get the integration with eager loading
        stmt = (
            select(Integration)
            .where(Integration.id == integration_id)
            .options(
                selectinload(Integration.owner_team),
                selectinload(Integration.credentials),
                selectinload(Integration.shared_with),
                selectinload(Integration.resources),
                selectinload(Integration.events),
            )
        )
        result = await db.execute(stmt)
        integration = result.scalar_one_or_none()

        if not integration:
            return None

        # Check if already shared
        result = await db.execute(
            select(IntegrationShare).where(
                IntegrationShare.integration_id == integration_id,
                IntegrationShare.team_id == team_id,
            )
        )
        existing_share = result.scalar_one_or_none()

        if existing_share:
            # Update existing share
            existing_share.share_level = share_level
            existing_share.status = "active"
            existing_share.revoked_at = None
            share = existing_share
        else:
            # Create new share
            share = IntegrationShare(
                id=uuid.uuid4(),
                integration_id=integration_id,
                team_id=team_id,
                shared_by_user_id=user_id,
                share_level=share_level,
                status="active",
            )
            db.add(share)

        # Record the share event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=integration_id,
            event_type=EventType.SHARED,
            actor_user_id=user_id,
            affected_team_id=team_id,
            details={
                "share_level": share_level,
                "updated": existing_share is not None,
            },
        )
        db.add(event)

        return share

    @staticmethod
    async def revoke_integration_share(
        db: AsyncSession,
        integration_id: uuid.UUID,
        team_id: uuid.UUID,
        user_id: str,
    ) -> bool:
        """
        Revoke an integration share from a team.

        Args:
            db: Database session
            integration_id: UUID of the integration
            team_id: UUID of the team to revoke from
            user_id: ID of the user performing the revocation

        Returns:
            True if successful, False otherwise
        """
        # Get the share
        result = await db.execute(
            select(IntegrationShare).where(
                IntegrationShare.integration_id == integration_id,
                IntegrationShare.team_id == team_id,
            )
        )
        share = result.scalar_one_or_none()

        if not share:
            return False

        # Update the share
        share.status = "revoked"
        share.revoked_at = datetime.utcnow()

        # Record the unshare event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=integration_id,
            event_type=EventType.UNSHARED,
            actor_user_id=user_id,
            affected_team_id=team_id,
            details={
                "previous_share_level": share.share_level,
            },
        )
        db.add(event)

        return True

    @staticmethod
    async def get_integration_resources(
        db: AsyncSession,
        integration_id: uuid.UUID,
        resource_types: Optional[List[str]] = None,
    ) -> List[ServiceResource]:
        """
        Get resources for an integration.

        Args:
            db: Database session
            integration_id: UUID of the integration
            resource_types: Optional list of resource types to filter by

        Returns:
            List of ServiceResource objects
        """
        # Build the query
        query = select(ServiceResource).where(
            ServiceResource.integration_id == integration_id
        )

        # Add resource type filter if provided
        if resource_types:
            query = query.where(ServiceResource.resource_type.in_(resource_types))

        # Execute the query
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def grant_resource_access(
        db: AsyncSession,
        resource_id: uuid.UUID,
        team_id: uuid.UUID,
        user_id: str,
        access_level: AccessLevel = AccessLevel.READ,
    ) -> ResourceAccess:
        """
        Grant a team access to a specific resource.

        Args:
            db: Database session
            resource_id: UUID of the resource
            team_id: UUID of the team to grant access to
            user_id: ID of the user granting access
            access_level: Level of access to grant

        Returns:
            ResourceAccess object
        """
        # Get the resource
        stmt = (
            select(ServiceResource)
            .where(ServiceResource.id == resource_id)
            .options(selectinload(ServiceResource.integration))
        )
        result = await db.execute(stmt)
        resource = result.scalar_one_or_none()

        if not resource:
            raise ValueError(f"Resource {resource_id} not found")

        # Check if access already exists
        result = await db.execute(
            select(ResourceAccess).where(
                ResourceAccess.resource_id == resource_id,
                ResourceAccess.team_id == team_id,
            )
        )
        existing_access = result.scalar_one_or_none()

        if existing_access:
            # Update existing access
            existing_access.access_level = access_level
            access = existing_access
        else:
            # Create new access
            access = ResourceAccess(
                id=uuid.uuid4(),
                resource_id=resource_id,
                team_id=team_id,
                granted_by_user_id=user_id,
                access_level=access_level,
            )
            db.add(access)

        # Record the access change event
        event = IntegrationEvent(
            id=uuid.uuid4(),
            integration_id=resource.integration_id,
            event_type=EventType.ACCESS_CHANGED,
            actor_user_id=user_id,
            affected_team_id=team_id,
            details={
                "resource_id": str(resource_id),
                "resource_name": resource.name,
                "resource_type": resource.resource_type,
                "access_level": access_level,
                "updated": existing_access is not None,
            },
        )
        db.add(event)

        return access

    @staticmethod
    async def get_integration_events(
        db: AsyncSession,
        integration_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[IntegrationEvent]:
        """
        Get events for an integration.

        Args:
            db: Database session
            integration_id: UUID of the integration
            limit: Maximum number of events to return
            offset: Number of events to skip

        Returns:
            List of IntegrationEvent objects
        """
        result = await db.execute(
            select(IntegrationEvent)
            .where(IntegrationEvent.integration_id == integration_id)
            .order_by(IntegrationEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    @staticmethod
    async def get_resource_teams(
        db: AsyncSession,
        resource_id: uuid.UUID,
    ) -> List[Dict]:
        """
        Get teams with access to a resource.

        Args:
            db: Database session
            resource_id: UUID of the resource

        Returns:
            List of dictionaries with team_id, team_name, and access_level
        """
        result = await db.execute(
            select(ResourceAccess, Team)
            .join(Team, ResourceAccess.team_id == Team.id)
            .where(ResourceAccess.resource_id == resource_id)
        )

        teams = []
        for access, team in result:
            teams.append(
                {
                    "team_id": team.id,
                    "team_name": team.name,
                    "access_level": access.access_level,
                }
            )

        return teams
