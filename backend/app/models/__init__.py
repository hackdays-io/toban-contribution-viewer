"""
SQLAlchemy models for the application.
"""

# Import models to make them discoverable
from app.models.slack import (
    SlackAnalysis,
    SlackChannel,
    SlackContribution,
    SlackMessage,
    SlackReaction,
    SlackUser,
    SlackWorkspace,
    analysis_channels,
)
