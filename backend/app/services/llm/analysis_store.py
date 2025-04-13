"""
Service for storing and retrieving LLM analysis results in the database.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackAnalysis, SlackChannel, SlackChannelAnalysis

logger = logging.getLogger(__name__)


class AnalysisStoreService:
    """Service for storing and retrieving LLM analysis results."""

    @staticmethod
    async def store_channel_analysis(
        db: AsyncSession,
        workspace_id: str,
        channel_id: str,
        start_date: datetime,
        end_date: datetime,
        stats: Dict[str, int],
        analysis_results: Dict[str, str],
        model_used: str,
    ) -> SlackChannelAnalysis:
        """
        Store the results of a channel analysis in the database.

        Args:
            db: Database session
            workspace_id: ID of the workspace
            channel_id: ID of the channel
            start_date: Start date of the analysis period
            end_date: End date of the analysis period
            stats: Analysis statistics (message_count, participant_count, etc.)
            analysis_results: Analysis results from the LLM
            model_used: Name of the LLM model used for analysis

        Returns:
            The stored SlackChannelAnalysis model instance
        """
        # Find the channel by its database ID (not slack_id)
        try:
            channel_uuid = uuid.UUID(channel_id)
            workspace_uuid = (
                uuid.UUID(workspace_id)
                if not isinstance(workspace_id, uuid.UUID)
                else workspace_id
            )

            channel_query = select(SlackChannel).where(
                SlackChannel.id == channel_uuid,
                SlackChannel.workspace_id == workspace_uuid,
            )
        except ValueError:
            # If channel_id is not a valid UUID, try looking it up as slack_id
            channel_query = select(SlackChannel).where(
                SlackChannel.slack_id == channel_id,
                (
                    SlackChannel.workspace_id == uuid.UUID(workspace_id)
                    if not isinstance(workspace_id, uuid.UUID)
                    else workspace_id
                ),
            )
        result = await db.execute(channel_query)
        channel = result.scalars().first()

        if not channel:
            raise ValueError(
                f"Channel with ID {channel_id} not found in workspace {workspace_id}"
            )

        # Create or find an analysis record
        analysis_name = f"Channel analysis for #{channel.name}"
        analysis = SlackAnalysis(
            workspace_id=channel.workspace_id,
            name=analysis_name,
            description=f"Analysis of #{channel.name} from {start_date.date()} to {end_date.date()}",
            start_date=start_date,
            end_date=end_date,
            llm_model=model_used,
            analysis_type="channel_analysis",
            status="completed",
            progress=100.0,
            completion_time=datetime.utcnow(),
            result_summary={
                "channel_id": channel_id,
                "channel_name": channel.name,
                "message_count": stats.get("message_count", 0),
                "participant_count": stats.get("participant_count", 0),
            },
        )

        # Add the channel to the analysis
        analysis.channels.append(channel)

        # Create the channel analysis record
        channel_analysis = SlackChannelAnalysis(
            channel_id=channel.id,
            start_date=start_date,
            end_date=end_date,
            message_count=stats.get("message_count", 0),
            participant_count=stats.get("participant_count", 0),
            thread_count=stats.get("thread_count", 0),
            reaction_count=stats.get("reaction_count", 0),
            channel_summary=analysis_results.get("channel_summary", ""),
            topic_analysis=analysis_results.get("topic_analysis", ""),
            contributor_insights=analysis_results.get("contributor_insights", ""),
            key_highlights=analysis_results.get("key_highlights", ""),
            model_used=model_used,
            generated_at=datetime.utcnow(),
            raw_response=analysis_results,
            status="completed",
        )

        # Associate the channel analysis with the analysis
        analysis.channel_analyses.append(channel_analysis)

        # Save to the database
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        await db.refresh(channel_analysis)

        return channel_analysis

    @staticmethod
    async def get_channel_analyses_for_channel(
        db: AsyncSession, channel_id: str, limit: int = 10, offset: int = 0
    ) -> List[SlackChannelAnalysis]:
        """
        Get all analyses for a specific channel.

        Args:
            db: Database session
            channel_id: Channel ID to get analyses for
            limit: Maximum number of analyses to return
            offset: Offset for pagination

        Returns:
            List of SlackChannelAnalysis instances
        """
        # Try to parse channel_id as UUID first
        try:
            channel_uuid = uuid.UUID(channel_id)
            channel_query = select(SlackChannel).where(SlackChannel.id == channel_uuid)
        except ValueError:
            # If not a valid UUID, treat as slack_id
            channel_query = select(SlackChannel).where(
                SlackChannel.slack_id == channel_id
            )

        result = await db.execute(channel_query)
        channel = result.scalars().first()

        if not channel:
            return []

        query = (
            select(SlackChannelAnalysis)
            .where(SlackChannelAnalysis.channel_id == channel.id)
            .order_by(SlackChannelAnalysis.generated_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_latest_channel_analysis(
        db: AsyncSession, channel_id: str
    ) -> Optional[SlackChannelAnalysis]:
        """
        Get the most recent analysis for a specific channel.

        Args:
            db: Database session
            channel_id: Channel ID to get analysis for

        Returns:
            The most recent SlackChannelAnalysis instance, or None if no analyses exist
        """
        analyses = await AnalysisStoreService.get_channel_analyses_for_channel(
            db=db, channel_id=channel_id, limit=1, offset=0
        )

        return analyses[0] if analyses else None
