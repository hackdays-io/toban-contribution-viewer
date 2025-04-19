"""
SQLAlchemy models for Team and Team Member.
"""

import enum
from typing import List

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.db.base import Base
from app.models.base import BaseModel


class TeamMemberRole(str, enum.Enum):
    """Enum for team member roles."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class Team(Base, BaseModel):
    """
    Model for a Team, which is an organizational unit that groups related integrations.
    """

    # Team identifiers
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Team metadata
    avatar_url = Column(String(1024), nullable=True)
    team_size = Column(Integer, default=0, nullable=False)
    is_personal = Column(Boolean, default=False, nullable=False)
    team_metadata = Column(
        JSONB, nullable=True
    )  # Using team_metadata to avoid SQLAlchemy reserved name

    # Owner info
    created_by_user_id = Column(String(255), nullable=False)
    created_by_email = Column(String(255), nullable=True)

    # Relationships
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    slack_workspaces = relationship("SlackWorkspace", back_populates="team")
    # Integration relationships
    owned_integrations = relationship(
        "Integration", back_populates="owner_team", cascade="all, delete-orphan"
    )
    shared_integrations = relationship(
        "IntegrationShare", back_populates="team", cascade="all, delete-orphan"
    )
    resource_accesses = relationship(
        "ResourceAccess", back_populates="team", cascade="all, delete-orphan"
    )

    # Uniqueness constraints
    __table_args__ = (Index("ix_team_slug_unique", "slug", unique=True),)

    def __repr__(self) -> str:
        return f"<Team {self.name} ({self.id})>"


class TeamMember(Base, BaseModel):
    """
    Model for a Team Member, representing a user's membership in a team.
    """

    # Member info
    user_id = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    role = Column(Enum(TeamMemberRole), default=TeamMemberRole.MEMBER, nullable=False)

    # Invitation status
    invitation_status = Column(String(50), default="active", nullable=False)
    invitation_token = Column(String(255), nullable=True)
    invitation_expires_at = Column(DateTime, nullable=True)

    # Activity tracking
    last_active_at = Column(DateTime, nullable=True)

    # Foreign keys
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=False, index=True
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members")

    # Uniqueness constraints
    __table_args__ = (
        Index("ix_teammember_team_id_user_id", "team_id", "user_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<TeamMember {self.display_name or self.email} ({self.role}) in {self.team_id}>"
