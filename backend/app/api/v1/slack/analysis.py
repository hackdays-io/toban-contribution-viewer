"""
Slack channel analysis API endpoints.

DEPRECATED: These endpoints are being phased out in favor of the ResourceAnalysis system.
All functionality has been moved to the integration-based ResourceAnalysis endpoints.
"""

import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalysisOptions(BaseModel):
    """Options for configuring the channel analysis."""
    include_threads: bool = True
    include_reactions: bool = True
    model: Optional[str] = None
    use_json_mode: bool = True


class AnalysisResponse(BaseModel):
    """Response model for channel analysis results."""
    analysis_id: str
    channel_id: str
    channel_name: str
    period: Dict[str, datetime]
    stats: Dict[str, int]
    channel_summary: str
    topic_analysis: str
    contributor_insights: str
    key_highlights: str
    model_used: str
    generated_at: datetime
    report_id: Optional[str] = None
    team_id: Optional[str] = None
    is_unified_report: bool = False


class StoredAnalysisResponse(BaseModel):
    """Response model for retrieving stored channel analyses."""
    id: str
    channel_id: str
    channel_name: str
    start_date: datetime
    end_date: datetime
    message_count: int
    participant_count: int
    thread_count: int
    reaction_count: int
    channel_summary: str
    topic_analysis: str
    contributor_insights: str
    key_highlights: str
    model_used: str
    generated_at: datetime
    workspace_id: Optional[str] = None


class DeprecationResponse(BaseModel):
    """Response for deprecated endpoints."""
    message: str
    suggested_alternative: str


@router.post(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyze",
    response_model=DeprecationResponse,
    status_code=status.HTTP_410_GONE,
    summary="[DEPRECATED] Analyze Slack channel messages",
    description="This endpoint has been deprecated. Please use the integration-based ResourceAnalysis system instead.",
)
async def analyze_channel(
    workspace_id: str,
    channel_id: str,
    start_date: Optional[datetime] = Query(
        None, description="Start date for analysis period (defaults to 30 days ago)"
    ),
    end_date: Optional[datetime] = Query(
        None, description="End date for analysis period (defaults to current date)"
    ),
    include_threads: bool = Query(
        True, description="Whether to include thread replies in the analysis"
    ),
    include_reactions: bool = Query(
        True, description="Whether to include reactions data in the analysis"
    ),
    model: Optional[str] = Query(
        None, description="Specific LLM model to use"
    ),
    use_json_mode: bool = Query(
        True, description="Whether to request JSON-formatted responses from LLM (may not be supported by all models)"
    ),
    db: AsyncSession = Depends(get_async_db),
):
    """
    DEPRECATED: This endpoint has been removed. 
    Please use the integration-based ResourceAnalysis system instead.
    """
    return DeprecationResponse(
        message="This endpoint has been deprecated and removed.",
        suggested_alternative="Please use POST /integrations/{integration_id}/resources/{resource_id}/analyze instead."
    )


@router.get(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyses",
    response_model=DeprecationResponse,
    status_code=status.HTTP_410_GONE,
    summary="[DEPRECATED] Get stored channel analyses",
    description="This endpoint has been deprecated. Please use the integration-based ResourceAnalysis system instead.",
)
async def get_channel_analyses(
    workspace_id: str,
    channel_id: str,
    limit: int = Query(
        10, ge=1, le=100, description="Maximum number of analyses to return"
    ),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_async_db),
):
    """
    DEPRECATED: This endpoint has been removed.
    Please use the integration-based ResourceAnalysis system instead.
    """
    return DeprecationResponse(
        message="This endpoint has been deprecated and removed.",
        suggested_alternative="Please use GET /integrations/{integration_id}/resources/{resource_id}/analyses instead."
    )


@router.get(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyses/latest",
    response_model=DeprecationResponse,
    status_code=status.HTTP_410_GONE,
    summary="[DEPRECATED] Get latest channel analysis",
    description="This endpoint has been deprecated. Please use the integration-based ResourceAnalysis system instead.",
)
async def get_latest_channel_analysis(
    workspace_id: str,
    channel_id: str,
    db: AsyncSession = Depends(get_async_db),
):
    """
    DEPRECATED: This endpoint has been removed.
    Please use the integration-based ResourceAnalysis system instead.
    """
    return DeprecationResponse(
        message="This endpoint has been deprecated and removed.",
        suggested_alternative="Please use GET /integrations/{integration_id}/resources/{resource_id}/analyses/latest instead."
    )