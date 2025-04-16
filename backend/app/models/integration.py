"""
SQLAlchemy models for team integrations.

This module defines models for managing integrations with external services
(Slack, GitHub, Notion) in a way that allows them to be shared between teams.
"""

import enum
from typing import List, Optional

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.db.base import Base
from app.models.base import BaseModel
from app.models.team import Team


class IntegrationType(str, enum.Enum):
    """Enum for integration service types."""

    SLACK = "slack"
    GITHUB = "github"
    NOTION = "notion"
    DISCORD = "discord"  # Future support


class IntegrationStatus(str, enum.Enum):
    """Enum for integration connection status."""

    ACTIVE = "active"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"


class CredentialType(str, enum.Enum):
    """Enum for integration credential types."""

    OAUTH_TOKEN = "oauth_token"
    PERSONAL_TOKEN = "personal_token"
    API_KEY = "api_key"
    APP_TOKEN = "app_token"


class ShareLevel(str, enum.Enum):
    """Enum for integration sharing permission levels."""

    FULL_ACCESS = "full_access"  # Can use all functionality
    LIMITED_ACCESS = "limited_access"  # Can use limited functionality
    READ_ONLY = "read_only"  # Can only view resources


class ResourceType(str, enum.Enum):
    """Enum for service resources."""

    # Slack resources
    SLACK_CHANNEL = "slack_channel"
    SLACK_USER = "slack_user"
    SLACK_EMOJI = "slack_emoji"

    # GitHub resources
    GITHUB_REPOSITORY = "github_repository"
    GITHUB_ISSUE = "github_issue"
    GITHUB_PR = "github_pr"
    GITHUB_WEBHOOK = "github_webhook"

    # Notion resources
    NOTION_PAGE = "notion_page"
    NOTION_DATABASE = "notion_database"
    NOTION_BLOCK = "notion_block"

    # Discord resources (future)
    DISCORD_GUILD = "discord_guild"
    DISCORD_CHANNEL = "discord_channel"


class AccessLevel(str, enum.Enum):
    """Enum for resource access permission levels."""

    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


class EventType(str, enum.Enum):
    """Enum for integration event types."""

    CREATED = "created"
    SHARED = "shared"
    UNSHARED = "unshared"
    UPDATED = "updated"
    DISCONNECTED = "disconnected"
    ACCESS_CHANGED = "access_changed"
    ERROR = "error"


class Integration(Base, BaseModel):
    """
    Model for a service integration that can be shared between teams.
    """

    # Integration identifiers
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    service_type = Column(Enum(IntegrationType), nullable=False)

    # Status and metadata
    status = Column(
        Enum(IntegrationStatus), default=IntegrationStatus.ACTIVE, nullable=False
    )
    integration_metadata = Column(
        JSONB, nullable=True
    )  # Service-specific configuration (renamed from metadata to avoid SQLAlchemy conflict)
    last_used_at = Column(DateTime, nullable=True)

    # Owner info
    owner_team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=False, index=True
    )
    created_by_user_id = Column(String(255), nullable=False)

    # Relationships
    owner_team: Mapped["Team"] = relationship(
        "Team", back_populates="owned_integrations"
    )
    credentials: Mapped[List["IntegrationCredential"]] = relationship(
        "IntegrationCredential",
        back_populates="integration",
        cascade="all, delete-orphan",
    )
    shared_with: Mapped[List["IntegrationShare"]] = relationship(
        "IntegrationShare", back_populates="integration", cascade="all, delete-orphan"
    )
    resources: Mapped[List["ServiceResource"]] = relationship(
        "ServiceResource", back_populates="integration", cascade="all, delete-orphan"
    )
    events: Mapped[List["IntegrationEvent"]] = relationship(
        "IntegrationEvent", back_populates="integration", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Integration {self.name} ({self.service_type}, {self.id})>"


class IntegrationCredential(Base, BaseModel):
    """
    Model for integration credentials, separated for enhanced security.
    """

    # Credential data
    credential_type = Column(Enum(CredentialType), nullable=False)
    encrypted_value = Column(String(2048), nullable=False)  # Encrypted token
    expires_at = Column(DateTime, nullable=True)  # Null for non-expiring tokens
    refresh_token = Column(String(2048), nullable=True)  # Encrypted, if applicable
    scopes = Column(JSONB, nullable=True)  # Permissions granted

    # Foreign keys
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integration.id"), nullable=False, index=True
    )

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration", back_populates="credentials"
    )

    def __repr__(self) -> str:
        return (
            f"<IntegrationCredential {self.credential_type} for {self.integration_id}>"
        )


class IntegrationShare(Base, BaseModel):
    """
    Model for sharing integrations between teams.
    """
    __tablename__ = "integration_share"

    # Sharing info
    share_level = Column(Enum(ShareLevel), default=ShareLevel.READ_ONLY, nullable=False)
    status = Column(String(50), default="active", nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    # Foreign keys
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integration.id"), nullable=False, index=True
    )
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=False, index=True
    )
    shared_by_user_id = Column(String(255), nullable=False)

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration", back_populates="shared_with"
    )
    team: Mapped["Team"] = relationship("Team", back_populates="shared_integrations")

    # Ensure unique sharing between integration and team
    __table_args__ = (
        Index(
            "ix_integration_share_integration_id_team_id",
            "integration_id",
            "team_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<IntegrationShare {self.integration_id} with {self.team_id}>"


class ServiceResource(Base, BaseModel):
    """
    Model for resources within external services (repos, channels, etc.).
    """

    # Resource data
    resource_type = Column(Enum(ResourceType), nullable=False)
    external_id = Column(String(255), nullable=False)  # ID in external service
    name = Column(String(255), nullable=False)
    resource_metadata = Column(
        JSONB, nullable=True
    )  # Additional properties (renamed from metadata to avoid SQLAlchemy conflict)
    last_synced_at = Column(DateTime, nullable=True)

    # Foreign keys
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integration.id"), nullable=False, index=True
    )

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration", back_populates="resources"
    )
    access_grants: Mapped[List["ResourceAccess"]] = relationship(
        "ResourceAccess", back_populates="resource", cascade="all, delete-orphan"
    )

    # Ensure unique resources per integration
    __table_args__ = (
        Index(
            "ix_serviceresource_integration_id_resource_type_external_id",
            "integration_id",
            "resource_type",
            "external_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ServiceResource {self.resource_type} {self.name} ({self.external_id})>"
        )


class ResourceAccess(Base, BaseModel):
    """
    Model for controlling team access to specific resources.
    """

    # Access data
    access_level = Column(Enum(AccessLevel), default=AccessLevel.READ, nullable=False)

    # Foreign keys
    resource_id = Column(
        UUID(as_uuid=True), ForeignKey("serviceresource.id"), nullable=False, index=True
    )
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=False, index=True
    )
    granted_by_user_id = Column(String(255), nullable=False)

    # Relationships
    resource: Mapped["ServiceResource"] = relationship(
        "ServiceResource", back_populates="access_grants"
    )
    team: Mapped["Team"] = relationship("Team", back_populates="resource_accesses")

    # Ensure unique access grants per resource and team
    __table_args__ = (
        Index(
            "ix_resourceaccess_resource_id_team_id",
            "resource_id",
            "team_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<ResourceAccess {self.team_id} to {self.resource_id} ({self.access_level})>"


class IntegrationEvent(Base, BaseModel):
    """
    Model for tracking important events related to integrations.
    """

    # Event data
    event_type = Column(Enum(EventType), nullable=False)
    details = Column(JSONB, nullable=True)

    # Foreign keys
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integration.id"), nullable=False, index=True
    )
    actor_user_id = Column(String(255), nullable=False)
    affected_team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=True, index=True
    )

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration", back_populates="events"
    )
    affected_team: Mapped[Optional["Team"]] = relationship("Team")

    def __repr__(self) -> str:
        return f"<IntegrationEvent {self.event_type} for {self.integration_id}>"
