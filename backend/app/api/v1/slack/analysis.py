"""
Slack channel analysis API endpoints.

This module provides endpoints for analyzing Slack channel messages using LLMs
to extract insights about communication patterns, key contributors, and discussion topics.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.services.llm.analysis_store import AnalysisStoreService
from app.services.llm.openrouter import OpenRouterService
from app.services.slack.channels import get_channel_by_id
from app.services.slack.messages import get_channel_messages, get_channel_users

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalysisOptions(BaseModel):
    """Options for configuring the channel analysis."""

    include_threads: bool = True
    include_reactions: bool = True
    model: Optional[str] = None


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


@router.post(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyze",
    response_model=AnalysisResponse,
    summary="Analyze Slack channel messages",
    description="Uses LLM to analyze messages in a Slack channel and provide insights about communication patterns, key contributors, and discussion topics.",
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
        None, description="Specific LLM model to use (see OpenRouter docs)"
    ),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Analyze messages in a Slack channel using LLM to provide insights.

    This endpoint:
    1. Retrieves messages for the specified channel and date range
    2. Processes messages into a format suitable for LLM analysis
    3. Sends data to OpenRouter LLM API for analysis
    4. Returns structured insights about communication patterns

    The analysis includes:
    - Channel summary (purpose, activity patterns)
    - Topic analysis (main discussion topics)
    - Contributor insights (key contributors and their patterns)
    - Key highlights (notable discussions worth attention)
    """
    # Default to last 30 days if dates not provided
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Create an instance of the OpenRouter service
    llm_service = OpenRouterService()

    try:
        # Get channel info
        channel = await get_channel_by_id(db, workspace_id, channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Get messages for the channel within the date range
        messages = await get_channel_messages(
            db,
            workspace_id,
            channel_id,
            start_date=start_date,
            end_date=end_date,
            include_replies=include_threads,
        )

        # Get user data for the channel
        users = await get_channel_users(db, workspace_id, channel_id)

        # Process messages and add user data
        processed_messages = []
        user_dict = {user.slack_id: user for user in users}
        message_count = 0
        thread_count = 0
        reaction_count = 0
        participant_set = set()

        for msg in messages:
            message_count += 1
            if msg.user_id:
                participant_set.add(msg.user_id)

            if msg.is_thread_parent:
                thread_count += 1

            if msg.reaction_count:
                reaction_count += msg.reaction_count

            user = user_dict.get(msg.user_id) if msg.user_id else None
            user_name = user.display_name or user.name if user else "Unknown User"

            processed_messages.append(
                {
                    "id": msg.id,
                    "user_id": msg.user_id,
                    "user_name": user_name,
                    "text": msg.text,
                    "timestamp": msg.message_datetime.isoformat(),
                    "is_thread_parent": msg.is_thread_parent,
                    "is_thread_reply": msg.is_thread_reply,
                    "thread_ts": msg.thread_ts,
                    "has_attachments": msg.has_attachments,
                    "reaction_count": msg.reaction_count,
                }
            )

        # Prepare data for LLM analysis
        messages_data = {
            "message_count": message_count,
            "participant_count": len(participant_set),
            "thread_count": thread_count,
            "reaction_count": reaction_count,
            "messages": processed_messages,
        }

        # Call the LLM service to analyze the data
        analysis_results = await llm_service.analyze_channel_messages(
            channel_name=channel.name,
            messages_data=messages_data,
            start_date=start_date,
            end_date=end_date,
            model=model,
        )

        # Store analysis results in the database
        stats = {
            "message_count": message_count,
            "participant_count": len(participant_set),
            "thread_count": thread_count,
            "reaction_count": reaction_count,
        }

        try:
            await AnalysisStoreService.store_channel_analysis(
                db=db,
                workspace_id=workspace_id,
                channel_id=channel_id,
                start_date=start_date,
                end_date=end_date,
                stats=stats,
                analysis_results=analysis_results,
                model_used=analysis_results.get("model_used", model or ""),
            )
            logger.info(f"Stored analysis for channel {channel_id}")
        except Exception as e:
            logger.error(f"Error storing analysis results: {str(e)}")
            # We'll continue with the API response even if storage fails

        # Build the response
        response = AnalysisResponse(
            analysis_id=f"analysis_{channel_id}_{int(datetime.utcnow().timestamp())}",
            channel_id=channel_id,
            channel_name=channel.name,
            period={"start": start_date, "end": end_date},
            stats=stats,
            channel_summary=analysis_results.get("channel_summary", ""),
            topic_analysis=analysis_results.get("topic_analysis", ""),
            contributor_insights=analysis_results.get("contributor_insights", ""),
            key_highlights=analysis_results.get("key_highlights", ""),
            model_used=analysis_results.get("model_used", ""),
            generated_at=datetime.utcnow(),
        )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle specific known errors
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log and raise a generic error
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Error analyzing channel: {str(e)}"
        )


@router.get(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyses",
    response_model=List[StoredAnalysisResponse],
    summary="Get stored channel analyses",
    description="Retrieves previously run channel analyses from the database.",
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
    Get stored channel analyses from the database.

    Retrieves previously stored LLM analyses for a specific channel, ordered by most recent first.
    """
    try:
        # Get the channel to ensure it exists and get the channel name
        channel = await get_channel_by_id(db, workspace_id, channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Get the stored analyses
        analyses = await AnalysisStoreService.get_channel_analyses_for_channel(
            db=db, channel_id=channel_id, limit=limit, offset=offset
        )

        # Convert to response model
        response = []
        for analysis in analyses:
            response.append(
                StoredAnalysisResponse(
                    id=str(analysis.id),
                    channel_id=channel_id,
                    channel_name=channel.name,
                    start_date=analysis.start_date,
                    end_date=analysis.end_date,
                    message_count=analysis.message_count,
                    participant_count=analysis.participant_count,
                    thread_count=analysis.thread_count,
                    reaction_count=analysis.reaction_count,
                    channel_summary=analysis.channel_summary,
                    topic_analysis=analysis.topic_analysis,
                    contributor_insights=analysis.contributor_insights,
                    key_highlights=analysis.key_highlights,
                    model_used=analysis.model_used,
                    generated_at=analysis.generated_at,
                )
            )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving stored analyses: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error retrieving stored analyses: {str(e)}"
        )


@router.get(
    "/workspaces/{workspace_id}/channels/{channel_id}/analyses/latest",
    response_model=Optional[StoredAnalysisResponse],
    summary="Get latest channel analysis",
    description="Retrieves the most recent channel analysis from the database.",
)
async def get_latest_channel_analysis(
    workspace_id: str,
    channel_id: str,
    db: AsyncSession = Depends(get_async_db),
):
    """
    Get the most recent channel analysis from the database.

    Retrieves the latest LLM analysis for a specific channel.
    """
    try:
        # Get the channel to ensure it exists and get the channel name
        channel = await get_channel_by_id(db, workspace_id, channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Get the latest analysis
        analysis = await AnalysisStoreService.get_latest_channel_analysis(
            db=db,
            channel_id=channel_id,
        )

        if not analysis:
            return None

        # Convert to response model
        return StoredAnalysisResponse(
            id=str(analysis.id),
            channel_id=channel_id,
            channel_name=channel.name,
            start_date=analysis.start_date,
            end_date=analysis.end_date,
            message_count=analysis.message_count,
            participant_count=analysis.participant_count,
            thread_count=analysis.thread_count,
            reaction_count=analysis.reaction_count,
            channel_summary=analysis.channel_summary,
            topic_analysis=analysis.topic_analysis,
            contributor_insights=analysis.contributor_insights,
            key_highlights=analysis.key_highlights,
            model_used=analysis.model_used,
            generated_at=analysis.generated_at,
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving latest analysis: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error retrieving latest analysis: {str(e)}"
        )
