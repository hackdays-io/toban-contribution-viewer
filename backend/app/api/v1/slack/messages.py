"""
Slack messages API routes.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.services.slack.messages import SlackMessageService

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["slack_messages"])


class DateRangeRequest(BaseModel):
    """Request model for date range filtering."""

    start_date: datetime = Field(..., description="Start date for message filtering")
    end_date: datetime = Field(..., description="End date for message filtering")
    include_replies: bool = Field(True, description="Whether to include thread replies")


@router.get("/workspaces/{workspace_id}/channels/{channel_id}/messages")
async def get_channel_messages(
    workspace_id: str,
    channel_id: str,
    start_date: Optional[datetime] = Query(
        None, description="Start date for message filtering"
    ),
    end_date: Optional[datetime] = Query(
        None, description="End date for message filtering"
    ),
    include_replies: bool = Query(
        True, description="Whether to include thread replies"
    ),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of messages to retrieve"
    ),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get messages from a specific channel with optional date filtering and pagination.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        start_date: Optional start date for filtering messages
        end_date: Optional end date for filtering messages
        include_replies: Whether to include thread replies
        limit: Maximum number of messages to retrieve
        cursor: Pagination cursor for retrieving the next set of results
        db: Database session

    Returns:
        Dictionary with messages and pagination information
    """
    try:
        logger.info(
            f"Fetching messages for channel {channel_id} in workspace {workspace_id}, "
            f"date range: {start_date} to {end_date}, limit: {limit}, cursor: {cursor}"
        )

        result = await SlackMessageService.get_channel_messages(
            db=db,
            workspace_id=workspace_id,
            channel_id=channel_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            cursor=cursor,
            include_replies=include_replies,
        )

        logger.info(
            f"Retrieved {len(result.get('messages', []))} messages for channel {channel_id}"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching channel messages: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving channel messages",
        )


@router.get("/workspaces/{workspace_id}/messages")
async def get_messages_by_date_range(
    workspace_id: str,
    channel_ids: List[str] = Query(..., description="List of channel UUIDs to include"),
    start_date: datetime = Query(..., description="Start date for message filtering"),
    end_date: datetime = Query(..., description="End date for message filtering"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        100, ge=1, le=1000, description="Number of messages per page"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get messages from multiple channels filtered by date range with pagination.

    Args:
        workspace_id: UUID of the workspace
        channel_ids: List of channel UUIDs to include
        start_date: Start date for filtering messages
        end_date: End date for filtering messages
        page: Page number for pagination
        page_size: Number of messages per page
        db: Database session

    Returns:
        Dictionary with messages and pagination information
    """
    try:
        logger.info(
            f"Fetching messages for workspace {workspace_id} across {len(channel_ids)} channels, "
            f"date range: {start_date} to {end_date}, page: {page}, page_size: {page_size}"
        )

        result = await SlackMessageService.get_messages_by_date_range(
            db=db,
            workspace_id=workspace_id,
            channel_ids=channel_ids,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )

        logger.info(
            f"Retrieved {len(result.get('messages', []))} messages across multiple channels"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages by date range: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving messages"
        )


@router.post("/workspaces/{workspace_id}/channels/{channel_id}/sync")
async def sync_channel_messages(
    workspace_id: str,
    channel_id: str,
    date_range: Optional[DateRangeRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    include_replies: bool = Query(
        True, description="Whether to include thread replies"
    ),
    batch_size: int = Query(
        200, ge=50, le=1000, description="Number of messages per batch"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Sync messages from a Slack channel to the database.

    This endpoint initiates a background task for syncing messages to prevent timeouts.
    It returns immediately with a status message while the sync continues in the background.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        date_range: Optional date range for filtering messages
        background_tasks: FastAPI background tasks handler
        include_replies: Whether to include thread replies
        batch_size: Number of messages to process in each batch
        db: Database session

    Returns:
        Dictionary with status information
    """
    try:
        logger.info(
            f"Initiating message sync for channel {channel_id} in workspace {workspace_id}, "
            f"date range: {date_range.start_date if date_range else None} to "
            f"{date_range.end_date if date_range else None}, batch_size: {batch_size}"
        )

        # Start the sync process in a background task
        background_tasks.add_task(
            SlackMessageService.sync_channel_messages,
            db=db,
            workspace_id=workspace_id,
            channel_id=channel_id,
            start_date=date_range.start_date if date_range else None,
            end_date=date_range.end_date if date_range else None,
            include_replies=include_replies,
            batch_size=batch_size,
        )

        return {
            "status": "syncing",
            "message": "Message synchronization started. This process will continue in the background and may take a few minutes depending on the date range and message volume.",
            "workspace_id": workspace_id,
            "channel_id": channel_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating message sync: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while initiating message sync"
        )
