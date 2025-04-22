"""
SQLAlchemy models for the application.
"""

from app.models.integration import (  # noqa: F401
    AccessLevel,
    CredentialType,
    EventType,
    Integration,
    IntegrationCredential,
    IntegrationEvent,
    IntegrationShare,
    IntegrationStatus,
    IntegrationType,
    ResourceAccess,
    ResourceType,
    ServiceResource,
    ShareLevel,
)

# Import models to make them discoverable
from app.models.slack import (  # noqa: F401
    SlackAnalysis,
    SlackChannel,
    SlackContribution,
    SlackMessage,
    SlackReaction,
    SlackUser,
    SlackWorkspace,
    analysis_channels,
)
from app.models.team import Team, TeamMember, TeamMemberRole  # noqa: F401
from app.models.reports import (  # noqa: F401
    CrossResourceReport,
    ResourceAnalysis,
    ReportStatus,
    ResourceType as AnalysisResourceType,  # Rename to avoid confusion with integration.ResourceType
    AnalysisType,
)
