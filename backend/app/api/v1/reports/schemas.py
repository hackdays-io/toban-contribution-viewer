"""
Pydantic schemas for cross-resource reports API endpoints.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field, validator
from pydantic.generics import GenericModel


class ResourceTypeEnum(str, Enum):
    """Resource types enum for API schemas."""

    SLACK_CHANNEL = "SLACK_CHANNEL"
    GITHUB_REPO = "GITHUB_REPO"
    NOTION_PAGE = "NOTION_PAGE"


class AnalysisTypeEnum(str, Enum):
    """Analysis types enum for API schemas."""

    CONTRIBUTION = "CONTRIBUTION"
    TOPICS = "TOPICS"
    SENTIMENT = "SENTIMENT"
    ACTIVITY = "ACTIVITY"


class ReportStatusEnum(str, Enum):
    """Report status enum for API schemas."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ReportFilterParams(BaseModel):
    """Query parameters for filtering reports."""

    status: Optional[ReportStatusEnum] = Field(None, description="Filter by report status")
    resource_type: Optional[ResourceTypeEnum] = Field(None, description="Filter by resource type")
    start_date: Optional[datetime] = Field(None, description="Filter by reports starting after this date")
    end_date: Optional[datetime] = Field(None, description="Filter by reports ending before this date")
    page: int = Field(1, description="Page number", ge=1)
    page_size: int = Field(20, description="Number of items per page", ge=1, le=100)
    sort_by: str = Field("created_at", description="Field to sort by")
    sort_order: str = Field("desc", description="Sort order (asc or desc)")

    @validator("sort_order")
    def validate_sort_order(cls, v):
        """Validate sort order is either asc or desc."""
        if v not in ["asc", "desc"]:
            raise ValueError("sort_order must be either 'asc' or 'desc'")
        return v


class ResourceAnalysisFilterParams(BaseModel):
    """Query parameters for filtering resource analyses."""

    status: Optional[ReportStatusEnum] = Field(None, description="Filter by analysis status")
    resource_type: Optional[ResourceTypeEnum] = Field(None, description="Filter by resource type")
    analysis_type: Optional[AnalysisTypeEnum] = Field(None, description="Filter by analysis type")
    page: int = Field(1, description="Page number", ge=1)
    page_size: int = Field(20, description="Number of items per page", ge=1, le=100)


class ResourceAnalysisBase(BaseModel):
    """Base schema for resource analysis data."""

    integration_id: UUID = Field(..., description="Integration ID")
    resource_id: UUID = Field(..., description="Resource ID")
    resource_type: ResourceTypeEnum = Field(..., description="Type of resource")
    analysis_type: AnalysisTypeEnum = Field(..., description="Type of analysis")
    period_start: datetime = Field(..., description="Start of analysis period")
    period_end: datetime = Field(..., description="End of analysis period")
    analysis_parameters: Optional[Dict] = Field(None, description="Parameters for the analysis")


class CrossResourceReportBase(BaseModel):
    """Base schema for cross-resource report data."""

    title: str = Field(..., description="Report title", max_length=255)
    description: Optional[str] = Field(None, description="Report description")
    date_range_start: datetime = Field(..., description="Start of report date range")
    date_range_end: datetime = Field(..., description="End of report date range")
    report_parameters: Optional[Dict] = Field(None, description="Parameters for the report")


class CrossResourceReportCreate(CrossResourceReportBase):
    """Schema for creating a new cross-resource report."""

    resource_analyses: Optional[List[ResourceAnalysisBase]] = Field(
        None, description="Resource analyses to include in the report"
    )


class CrossResourceReportUpdate(BaseModel):
    """Schema for updating an existing cross-resource report."""

    title: Optional[str] = Field(None, description="Report title", max_length=255)
    description: Optional[str] = Field(None, description="Report description")
    date_range_start: Optional[datetime] = Field(None, description="Start of report date range")
    date_range_end: Optional[datetime] = Field(None, description="End of report date range")
    report_parameters: Optional[Dict] = Field(None, description="Parameters for the report")


class ResourceAnalysisResponse(ResourceAnalysisBase):
    """Response schema for resource analysis data."""

    id: UUID = Field(..., description="Resource analysis ID")
    cross_resource_report_id: UUID = Field(..., description="Cross-resource report ID")
    status: ReportStatusEnum = Field(..., description="Analysis status")
    results: Optional[Dict] = Field(None, description="Analysis results")
    contributor_insights: Optional[str] = Field(None, description="LLM-generated contributor insights")
    topic_analysis: Optional[str] = Field(None, description="LLM-generated topic analysis")
    resource_summary: Optional[str] = Field(None, description="LLM-generated resource summary")
    key_highlights: Optional[str] = Field(None, description="LLM-generated key highlights")
    model_used: Optional[str] = Field(None, description="LLM model used for the analysis")
    analysis_generated_at: Optional[datetime] = Field(None, description="When the analysis was generated")
    # Statistics fields
    message_count: Optional[int] = Field(None, description="Number of messages in this resource")
    participant_count: Optional[int] = Field(None, description="Number of participants in this resource")
    thread_count: Optional[int] = Field(None, description="Number of threads in this resource")
    reaction_count: Optional[int] = Field(None, description="Number of reactions in this resource")
    workspace_uuid: Optional[UUID] = Field(None, description="UUID of the associated SlackWorkspace")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class CrossResourceReportResponse(CrossResourceReportBase):
    """Response schema for cross-resource report data."""

    id: UUID = Field(..., description="Report ID")
    team_id: UUID = Field(..., description="Team ID")
    status: ReportStatusEnum = Field(..., description="Report status")
    comprehensive_analysis: Optional[str] = Field(None, description="LLM-generated comprehensive analysis")
    comprehensive_analysis_generated_at: Optional[datetime] = Field(
        None, description="When the comprehensive analysis was generated"
    )
    model_used: Optional[str] = Field(None, description="LLM model used for the analysis")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    # Summary statistics
    total_resources: Optional[int] = Field(None, description="Total number of resources analyzed")
    completed_analyses: Optional[int] = Field(None, description="Number of completed resource analyses")
    pending_analyses: Optional[int] = Field(None, description="Number of pending resource analyses")
    failed_analyses: Optional[int] = Field(None, description="Number of failed resource analyses")
    resource_types: Optional[List[str]] = Field(None, description="Types of resources included")
    # Message statistics
    total_messages: Optional[int] = Field(None, description="Total number of messages across all resources")
    total_participants: Optional[int] = Field(
        None, description="Total number of unique participants across all resources"
    )
    total_threads: Optional[int] = Field(None, description="Total number of threads across all resources")
    total_reactions: Optional[int] = Field(None, description="Total number of reactions across all resources")

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class CrossResourceReportDetailResponse(CrossResourceReportResponse):
    """Detailed response schema for cross-resource report data."""

    resource_analyses: Optional[List[ResourceAnalysisResponse]] = Field(
        None, description="Resource analyses included in the report"
    )


class ResourceAnalysisSummary(BaseModel):
    """Summary of resource analyses."""

    total: int = Field(..., description="Total number of analyses")
    completed: int = Field(..., description="Number of completed analyses")
    pending: int = Field(..., description="Number of pending analyses")
    in_progress: int = Field(..., description="Number of in-progress analyses")
    failed: int = Field(..., description="Number of failed analyses")
    resource_types: Dict[str, int] = Field(..., description="Count of analyses by resource type")
    analysis_types: Dict[str, int] = Field(..., description="Count of analyses by analysis type")


class ReportGenerationResponse(BaseModel):
    """Response for report generation request."""

    report_id: UUID = Field(..., description="Report ID")
    status: ReportStatusEnum = Field(..., description="Updated report status")
    resource_analyses_created: int = Field(..., description="Number of resource analyses created")
    message: str = Field(..., description="Status message")


# Schema for creating a new report from channels
class ChannelReportCreate(BaseModel):
    """Schema for creating a new channel-based report."""

    team_id: UUID = Field(..., description="Team ID")
    channels: List[Dict[str, str]] = Field(
        ...,
        description="List of channels to include in the report",
        example=[
            {
                "id": "uuid-here",
                "name": "general",
                "integration_id": "integration-uuid-here",
            }
        ],
    )
    title: Optional[str] = Field(None, description="Custom report title")
    description: Optional[str] = Field(None, description="Custom report description")
    start_date: datetime = Field(..., description="Start date for analysis period")
    end_date: datetime = Field(..., description="End date for analysis period")
    include_threads: bool = Field(True, description="Whether to include thread replies")
    include_reactions: bool = Field(True, description="Whether to include reactions")
    analysis_type: str = Field("CONTRIBUTION", description="Type of analysis to perform")


# Generic paginated response type
T = TypeVar("T")


class PaginatedResponse(GenericModel, Generic[T]):
    """Generic paginated response."""

    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(cls, items: List[T], total: int, page: int, page_size: int):
        """Create a paginated response."""
        pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(items=items, total=total, page=page, page_size=page_size, pages=pages)
