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
from app.models.reports import (  # noqa: F401
    AnalysisResourceType,
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)

# Import models to make them discoverable
from app.models.slack import (  # noqa: F401; Legacy models removed: SlackAnalysis, SlackContribution, analysis_channels
    SlackChannel,
    SlackMessage,
    SlackReaction,
    SlackUser,
    SlackWorkspace,
)
from app.models.team import Team, TeamMember, TeamMemberRole  # noqa: F401
