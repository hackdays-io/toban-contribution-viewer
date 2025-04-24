"""
SQLAlchemy models for Slack integration.
"""

import uuid  # noqa: F401
from datetime import datetime
from typing import Any, Dict, List, Optional  # noqa: F401

from sqlalchemy import (  # noqa: F401
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.db.base import Base
from app.models.base import BaseModel
from app.models.team import Team

# Legacy analysis_channels association table removed


class SlackWorkspace(Base, BaseModel):
    """
    Model for a Slack workspace.
    """

    # Slack identifiers
    slack_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)

    # Workspace metadata
    icon_url = Column(String(1024), nullable=True)
    team_size = Column(Integer, nullable=True)
    workspace_metadata = Column(
        JSONB, nullable=True
    )  # Renamed from metadata (reserved name)

    # Connection status
    is_connected = Column(Boolean, default=True, nullable=False)
    connection_status = Column(String(50), default="active", nullable=False)
    last_connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_sync_at = Column(DateTime, nullable=True)

    # OAuth data - encrypted in database
    access_token = Column(String(1024), nullable=True)
    refresh_token = Column(String(1024), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    # Team association
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=True, index=True
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="slack_workspaces")
    channels: Mapped[List["SlackChannel"]] = relationship(
        "SlackChannel", back_populates="workspace"
    )
    users: Mapped[List["SlackUser"]] = relationship(
        "SlackUser", back_populates="workspace"
    )
    # Legacy SlackAnalysis relationship removed

    def __repr__(self) -> str:
        return f"<SlackWorkspace {self.name} ({self.slack_id})>"


class SlackChannel(Base, BaseModel):
    """
    Model for a Slack channel.
    """

    # Slack identifiers
    slack_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)

    # Channel metadata
    type = Column(String(50), nullable=False)  # 'public', 'private', 'im', 'mpim'
    purpose = Column(String(1024), nullable=True)
    topic = Column(String(1024), nullable=True)
    member_count = Column(Integer, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at_ts = Column(String(50), nullable=True)  # Slack timestamp

    # Bot status
    has_bot = Column(
        Boolean, default=False, nullable=False
    )  # Renamed from is_bot_member for clarity
    bot_joined_at = Column(DateTime, nullable=True)

    # Analysis flags
    is_selected_for_analysis = Column(Boolean, default=False, nullable=False)
    is_supported = Column(Boolean, default=True, nullable=False)

    # Sync status
    last_sync_at = Column(DateTime, nullable=True)
    oldest_synced_ts = Column(String(50), nullable=True)  # Slack timestamp
    latest_synced_ts = Column(String(50), nullable=True)  # Slack timestamp

    # Foreign keys
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("slackworkspace.id"), nullable=False
    )

    # Relationships
    workspace: Mapped["SlackWorkspace"] = relationship(
        "SlackWorkspace", back_populates="channels"
    )
    messages: Mapped[List["SlackMessage"]] = relationship(
        "SlackMessage", back_populates="channel"
    )
    # Legacy SlackAnalysis relationship removed

    # Ensure uniqueness of channels per workspace
    __table_args__ = (
        Index(
            "ix_slackchannel_workspace_id_slack_id",
            "workspace_id",
            "slack_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<SlackChannel #{self.name} ({self.slack_id})>"


class SlackUser(Base, BaseModel):
    """
    Model for a Slack user.
    """

    # Slack identifiers
    slack_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)

    # User metadata
    real_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    title = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    timezone = Column(String(100), nullable=True)
    timezone_offset = Column(Integer, nullable=True)
    profile_image_url = Column(String(1024), nullable=True)

    # Status flags
    is_bot = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    # Extra profile data
    profile_data = Column(JSONB, nullable=True)

    # Foreign keys
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("slackworkspace.id"), nullable=False
    )

    # Relationships
    workspace: Mapped["SlackWorkspace"] = relationship(
        "SlackWorkspace", back_populates="users"
    )
    messages: Mapped[List["SlackMessage"]] = relationship(
        "SlackMessage", back_populates="user"
    )
    reactions: Mapped[List["SlackReaction"]] = relationship(
        "SlackReaction", back_populates="user"
    )
    # Legacy SlackContribution relationship removed

    # Ensure uniqueness of users per workspace
    __table_args__ = (
        Index(
            "ix_slackuser_workspace_id_slack_id",
            "workspace_id",
            "slack_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<SlackUser {self.name} ({self.slack_id})>"


class SlackMessage(Base, BaseModel):
    """
    Model for a Slack message.
    """

    # Slack identifiers
    slack_id = Column(String(255), nullable=False, index=True)
    slack_ts = Column(String(50), nullable=False, index=True)  # Slack timestamp

    # Message content
    text = Column(Text, nullable=True)
    processed_text = Column(Text, nullable=True)  # Text after resolving mentions, etc.

    # Message metadata
    message_type = Column(
        String(50), default="message", nullable=False
    )  # 'message', 'bot_message', etc.
    subtype = Column(String(50), nullable=True)  # Slack message subtype
    is_edited = Column(Boolean, default=False, nullable=False)
    edited_ts = Column(String(50), nullable=True)  # Slack timestamp
    has_attachments = Column(Boolean, default=False, nullable=False)
    attachments = Column(JSONB, nullable=True)
    files = Column(JSONB, nullable=True)

    # Threading
    thread_ts = Column(String(50), nullable=True, index=True)  # Thread parent timestamp
    is_thread_parent = Column(Boolean, default=False, nullable=False)
    is_thread_reply = Column(Boolean, default=False, nullable=False)
    reply_count = Column(Integer, default=0, nullable=False)
    reply_users_count = Column(Integer, default=0, nullable=False)

    # Reactions count (for quick access)
    reaction_count = Column(Integer, default=0, nullable=False)

    # Message timestamp as datetime (for easier querying)
    message_datetime = Column(DateTime, nullable=False, index=True)

    # Analysis fields
    is_analyzed = Column(Boolean, default=False, nullable=False)
    message_category = Column(String(100), nullable=True)  # 'question', 'answer', etc.
    sentiment_score = Column(Float, nullable=True)
    analysis_data = Column(JSONB, nullable=True)

    # Foreign keys
    channel_id = Column(
        UUID(as_uuid=True), ForeignKey("slackchannel.id"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("slackuser.id"), nullable=True
    )  # Null for system messages
    parent_id = Column(
        UUID(as_uuid=True), ForeignKey("slackmessage.id"), nullable=True
    )  # For thread replies

    # Relationships
    channel: Mapped["SlackChannel"] = relationship(
        "SlackChannel", back_populates="messages"
    )
    user: Mapped[Optional["SlackUser"]] = relationship(
        "SlackUser", back_populates="messages"
    )
    reactions: Mapped[List["SlackReaction"]] = relationship(
        "SlackReaction", back_populates="message"
    )
    # Self-referential relationship for threading
    parent: Mapped[Optional["SlackMessage"]] = relationship(
        "SlackMessage",
        foreign_keys=[parent_id],
        backref="replies",
        remote_side="SlackMessage.id",
    )

    # Indexes for efficient querying
    __table_args__ = (
        Index("ix_slackmessage_channel_id_slack_ts", "channel_id", "slack_ts"),
        Index("ix_slackmessage_user_id_slack_ts", "user_id", "slack_ts"),
        Index("ix_slackmessage_message_datetime", "message_datetime"),
    )

    def __repr__(self) -> str:
        return f"<SlackMessage {self.slack_ts} in {self.channel_id}>"


class SlackReaction(Base, BaseModel):
    """
    Model for a Slack reaction (emoji).
    """

    # Reaction data
    emoji_name = Column(String(255), nullable=False)
    emoji_code = Column(String(255), nullable=True)
    reaction_ts = Column(String(50), nullable=True)  # Slack timestamp

    # Foreign keys
    message_id = Column(
        UUID(as_uuid=True), ForeignKey("slackmessage.id"), nullable=False
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("slackuser.id"), nullable=False)

    # Relationships
    message: Mapped["SlackMessage"] = relationship(
        "SlackMessage", back_populates="reactions"
    )
    user: Mapped["SlackUser"] = relationship("SlackUser", back_populates="reactions")

    # Ensure uniqueness of reactions per message and user
    __table_args__ = (
        Index(
            "ix_slackreaction_message_id_user_id_emoji_name",
            "message_id",
            "user_id",
            "emoji_name",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<SlackReaction :{self.emoji_name}: by {self.user_id} on {self.message_id}>"


# Legacy model classes (SlackAnalysis, SlackContribution, SlackChannelAnalysis) removed
# These have been replaced by the resource-based analysis system
# See models/reports/cross_resource_report.py for the new model structure
