"""
SQLAlchemy models for cross-resource reports functionality.
"""

import enum
from typing import List

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    Integer,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.db.base import Base
from app.models.base import BaseModel


class ReportStatus(str, enum.Enum):
    """Status of a report or analysis."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AnalysisResourceType(str, enum.Enum):
    """Type of resource being analyzed."""

    SLACK_CHANNEL = "SLACK_CHANNEL"
    GITHUB_REPO = "GITHUB_REPO"
    NOTION_PAGE = "NOTION_PAGE"
    # Add more resource types as needed


class AnalysisType(str, enum.Enum):
    """Type of analysis being performed."""

    CONTRIBUTION = "CONTRIBUTION"
    TOPICS = "TOPICS"
    SENTIMENT = "SENTIMENT"
    ACTIVITY = "ACTIVITY"
    # Add more analysis types as needed


class CrossResourceReport(Base, BaseModel):
    """
    Model for a cross-resource report that spans multiple resources within a team.
    """

    # Foreign key to team
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("team.id"), nullable=False, index=True
    )

    # Report metadata
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum(ReportStatus, name="reportstatus"),
        default=ReportStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Date range for the report
    date_range_start = Column(DateTime, nullable=False)
    date_range_end = Column(DateTime, nullable=False)

    # Report configuration and results
    report_parameters = Column(JSONB, nullable=True)
    comprehensive_analysis = Column(Text, nullable=True)
    comprehensive_analysis_generated_at = Column(DateTime, nullable=True)
    model_used = Column(String(100), nullable=True)

    # Relationships
    team = relationship("Team", back_populates="cross_resource_reports")
    resource_analyses: Mapped[List["ResourceAnalysis"]] = relationship(
        "ResourceAnalysis",
        back_populates="cross_resource_report",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("ix_cross_resource_report_team_id_status", team_id, status),
    )


class ResourceAnalysis(Base, BaseModel):
    """
    Model for an analysis of a specific resource as part of a cross-resource report.
    """

    # Foreign keys
    cross_resource_report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("crossresourcereport.id"),
        nullable=False,
        index=True,
    )
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integration.id"), nullable=False, index=True
    )
    resource_id = Column(UUID(as_uuid=True), nullable=False)

    # Resource metadata
    resource_type = Column(
        Enum(AnalysisResourceType, name="analysisresourcetype"), nullable=False, index=True
    )
    analysis_type = Column(
        Enum(AnalysisType, name="analysistype"), nullable=False, index=True
    )
    status = Column(
        Enum(ReportStatus, name="reportstatus"),
        default=ReportStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Analysis configuration and results
    analysis_parameters = Column(JSONB, nullable=True)
    results = Column(JSONB, nullable=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    # LLM-generated analysis components
    contributor_insights = Column(Text, nullable=True)
    topic_analysis = Column(Text, nullable=True)
    resource_summary = Column(Text, nullable=True)
    key_highlights = Column(Text, nullable=True)
    model_used = Column(String(100), nullable=True)
    analysis_generated_at = Column(DateTime, nullable=True)
    
    # Statistics fields
    message_count = Column(Integer, nullable=True)
    participant_count = Column(Integer, nullable=True)
    thread_count = Column(Integer, nullable=True)
    reaction_count = Column(Integer, nullable=True)

    # Relationships
    cross_resource_report = relationship(
        "CrossResourceReport", back_populates="resource_analyses"
    )
    integration = relationship("Integration")

    # Indexes
    __table_args__ = (
        Index(
            "ix_resource_analysis_report_id_status", cross_resource_report_id, status
        ),
        Index("ix_resource_analysis_resource_type", resource_type),
    )
