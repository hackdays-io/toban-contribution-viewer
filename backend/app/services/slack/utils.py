"""
Utility functions for Slack services.
"""

import logging
from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackMessage

logger = logging.getLogger(__name__)


async def get_channel_message_stats(
    db: AsyncSession,
    channel_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, int]:
    """
    Get message statistics for a channel within a date range.

    Args:
        db: Database session
        channel_id: UUID of the channel
        start_date: Optional start date for filtering
        end_date: Optional end date for filtering

    Returns:
        Dictionary with message statistics (message_count, participant_count, thread_count, reaction_count)
    """
    try:
        # Base query for messages in this channel
        query = select(SlackMessage).where(SlackMessage.channel_id == channel_id)

        # Apply date filtering if specified
        if start_date:
            # Ensure timezone-naive datetime for comparison
            if hasattr(start_date, "tzinfo") and start_date.tzinfo:
                start_date = start_date.replace(tzinfo=None)
            query = query.where(SlackMessage.message_datetime >= start_date)

        if end_date:
            # Ensure timezone-naive datetime for comparison
            if hasattr(end_date, "tzinfo") and end_date.tzinfo:
                end_date = end_date.replace(tzinfo=None)
            query = query.where(SlackMessage.message_datetime <= end_date)

        # Count total messages
        message_count_query = select(func.count()).where(query.whereclause)
        message_count_result = await db.execute(message_count_query)
        message_count = message_count_result.scalar() or 0

        # Count unique participants (user_id is not null)
        participant_query = (
            select(func.count(SlackMessage.user_id.distinct()))
            .where(query.whereclause)
            .where(SlackMessage.user_id.isnot(None))
        )
        participant_result = await db.execute(participant_query)
        participant_count = participant_result.scalar() or 0

        # Count thread parents
        thread_query = select(func.count()).where(query.whereclause).where(SlackMessage.is_thread_parent.is_(True))
        thread_result = await db.execute(thread_query)
        thread_count = thread_result.scalar() or 0

        # Sum reaction counts
        reaction_query = select(func.sum(SlackMessage.reaction_count)).where(query.whereclause)
        reaction_result = await db.execute(reaction_query)
        reaction_count = reaction_result.scalar() or 0

        logger.info(
            f"Channel {channel_id} stats - Messages: {message_count}, "
            f"Participants: {participant_count}, Threads: {thread_count}, "
            f"Reactions: {reaction_count}"
        )

        return {
            "message_count": message_count,
            "participant_count": participant_count,
            "thread_count": thread_count,
            "reaction_count": reaction_count,
        }

    except Exception as e:
        logger.error(f"Error getting channel stats: {str(e)}")
        # Return zeros for all counts in case of error
        return {
            "message_count": 0,
            "participant_count": 0,
            "thread_count": 0,
            "reaction_count": 0,
        }
