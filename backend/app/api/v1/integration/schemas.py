"""
Pydantic schemas for integration API endpoints.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


# Enum definitions for API
class IntegrationTypeEnum(str, Enum):
    """Enum for integration service types."""

    SLACK = "slack"
    GITHUB = "github"
    NOTION = "notion"
    DISCORD = "discord"


class IntegrationStatusEnum(str, Enum):
    """Enum for integration connection status."""

    ACTIVE = "active"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"


class CredentialTypeEnum(str, Enum):
    """Enum for integration credential types."""

    OAUTH_TOKEN = "oauth_token"
    PERSONAL_TOKEN = "personal_token"
    API_KEY = "api_key"
    APP_TOKEN = "app_token"


class ShareLevelEnum(str, Enum):
    """Enum for integration sharing permission levels."""

    FULL_ACCESS = "full_access"
    LIMITED_ACCESS = "limited_access"
    READ_ONLY = "read_only"


class ResourceTypeEnum(str, Enum):
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

    # Discord resources
    DISCORD_GUILD = "discord_guild"
    DISCORD_CHANNEL = "discord_channel"


class AccessLevelEnum(str, Enum):
    """Enum for resource access permission levels."""

    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


class EventTypeEnum(str, Enum):
    """Enum for integration event types."""

    CREATED = "created"
    SHARED = "shared"
    UNSHARED = "unshared"
    UPDATED = "updated"
    DISCONNECTED = "disconnected"
    ACCESS_CHANGED = "access_changed"
    ERROR = "error"


# Base schemas
class ServiceResourceBase(BaseModel):
    """Base model for service resources."""

    resource_type: ResourceTypeEnum
    external_id: str
    name: str
    metadata: Optional[Dict] = None  # Maps to resource_metadata in the model


class IntegrationShareBase(BaseModel):
    """Base model for integration shares."""

    team_id: UUID
    share_level: ShareLevelEnum = ShareLevelEnum.READ_ONLY


class ResourceAccessBase(BaseModel):
    """Base model for resource access grants."""

    team_id: UUID
    access_level: AccessLevelEnum = AccessLevelEnum.READ


# Schemas for API requests
class IntegrationCreate(BaseModel):
    """Schema for creating a new integration."""

    name: str
    service_type: IntegrationTypeEnum
    description: Optional[str] = None
    team_id: UUID


class IntegrationUpdate(BaseModel):
    """Schema for updating an integration."""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[IntegrationStatusEnum] = None
    metadata: Optional[Dict] = None


class SlackIntegrationCreate(IntegrationCreate):
    """Schema for creating a new Slack integration via OAuth."""

    service_type: IntegrationTypeEnum = IntegrationTypeEnum.SLACK
    code: str
    redirect_uri: str


class GitHubIntegrationCreate(IntegrationCreate):
    """Schema for creating a new GitHub integration."""

    service_type: IntegrationTypeEnum = IntegrationTypeEnum.GITHUB
    token_type: CredentialTypeEnum
    token: str
    scope: Optional[str] = None


class NotionIntegrationCreate(IntegrationCreate):
    """Schema for creating a new Notion integration."""

    service_type: IntegrationTypeEnum = IntegrationTypeEnum.NOTION
    code: str
    redirect_uri: str


class IntegrationShareCreate(IntegrationShareBase):
    """Schema for creating a new integration share."""

    pass


class ResourceAccessCreate(ResourceAccessBase):
    """Schema for creating a new resource access grant."""

    pass


# Schemas for API responses
class TeamInfo(BaseModel):
    """Schema for team information in responses."""

    id: UUID
    name: str
    slug: str


class UserInfo(BaseModel):
    """Schema for user information in responses."""

    id: str
    email: Optional[str] = None
    name: Optional[str] = None


class ServiceResourceResponse(ServiceResourceBase):
    """Schema for service resource responses."""

    id: UUID
    integration_id: UUID
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class IntegrationShareResponse(IntegrationShareBase):
    """Schema for integration share responses."""

    id: UUID
    integration_id: UUID
    status: str
    revoked_at: Optional[datetime] = None
    shared_by: UserInfo
    team: TeamInfo
    created_at: datetime
    updated_at: datetime


class ResourceAccessResponse(ResourceAccessBase):
    """Schema for resource access responses."""

    id: UUID
    resource_id: UUID
    granted_by: UserInfo
    team: TeamInfo
    created_at: datetime
    updated_at: datetime


class IntegrationEventResponse(BaseModel):
    """Schema for integration event responses."""

    id: UUID
    integration_id: UUID
    event_type: EventTypeEnum
    details: Optional[Dict] = None
    actor: UserInfo
    affected_team: Optional[TeamInfo] = None
    created_at: datetime


class CredentialResponse(BaseModel):
    """Schema for credential responses (limited information)."""

    id: UUID
    credential_type: CredentialTypeEnum
    expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime


class IntegrationResponse(BaseModel):
    """Schema for integration responses."""

    id: UUID
    name: str
    description: Optional[str] = None
    service_type: IntegrationTypeEnum
    status: IntegrationStatusEnum
    metadata: Optional[Dict] = None  # Maps to integration_metadata in the model
    last_used_at: Optional[datetime] = None

    owner_team: TeamInfo
    created_by: UserInfo
    created_at: datetime
    updated_at: datetime

    # Optional related collections
    credentials: Optional[List[CredentialResponse]] = None
    resources: Optional[List[ServiceResourceResponse]] = None
    shared_with: Optional[List[IntegrationShareResponse]] = None

    class Config:
        orm_mode = True
