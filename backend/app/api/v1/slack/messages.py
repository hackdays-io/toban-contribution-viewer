"""
Slack messages API routes.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_async_db
from app.models.slack import SlackChannel, SlackMessage
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
    thread_only: bool = Query(
        False, description="Only retrieve thread parent messages"
    ),
    thread_ts: Optional[str] = Query(
        None, description="Filter by specific thread timestamp"
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
        thread_only: Only retrieve thread parent messages
        thread_ts: Filter by specific thread timestamp
        limit: Maximum number of messages to retrieve
        cursor: Pagination cursor for retrieving the next set of results
        db: Database session

    Returns:
        Dictionary with messages and pagination information
    """
    try:
        logger.info(
            f"Fetching messages for channel {channel_id} in workspace {workspace_id}, "
            f"date range: {start_date} to {end_date}, limit: {limit}, cursor: {cursor}, "
            f"thread_only: {thread_only}, thread_ts: {thread_ts}"
        )

        # Strip timezone info from datetime objects if present
        # Database uses timezone-naive datetimes
        safe_start_date = None
        safe_end_date = None

        if start_date:
            safe_start_date = start_date.replace(tzinfo=None)

        if end_date:
            safe_end_date = end_date.replace(tzinfo=None)

        logger.info(
            f"Using timezone-naive dates: start_date={safe_start_date}, end_date={safe_end_date}"
        )

        result = await SlackMessageService.get_channel_messages(
            db=db,
            workspace_id=workspace_id,
            channel_id=channel_id,
            start_date=safe_start_date,
            end_date=safe_end_date,
            limit=limit,
            cursor=cursor,
            include_replies=include_replies,
            thread_only=thread_only,
            thread_ts=thread_ts,
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

        # Strip timezone info from datetime objects if present
        # Database uses timezone-naive datetimes
        safe_start_date = start_date.replace(tzinfo=None)
        safe_end_date = end_date.replace(tzinfo=None)

        logger.info(
            f"Using timezone-naive dates: start_date={safe_start_date}, end_date={safe_end_date}"
        )

        result = await SlackMessageService.get_messages_by_date_range(
            db=db,
            workspace_id=workspace_id,
            channel_ids=channel_ids,
            start_date=safe_start_date,
            end_date=safe_end_date,
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


@router.get("/workspaces/{workspace_id}/users")
async def get_users_by_ids(
    workspace_id: str,
    user_ids: List[str] = Query(..., description="List of user UUIDs to retrieve"),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get user details for a list of user IDs within a workspace.

    Args:
        workspace_id: UUID of the workspace
        user_ids: List of user UUIDs to retrieve
        db: Database session

    Returns:
        Dictionary with user details
    """
    try:
        logger.info(
            f"Fetching user details for workspace {workspace_id}, user_ids: {user_ids}"
        )

        # Strip out any empty strings or None values
        valid_user_ids = [user_id for user_id in user_ids if user_id]

        if not valid_user_ids:
            return {"users": []}

        # Import locally to avoid clash with unused import warning
        from app.models.slack import SlackUser

        # Query users from database
        query = select(SlackUser).where(
            SlackUser.id.in_(valid_user_ids), SlackUser.workspace_id == workspace_id
        )

        result = await db.execute(query)
        users = result.scalars().all()

        # Convert users to dictionaries
        user_dicts = []
        for user in users:
            user_dicts.append(
                {
                    "id": str(user.id),
                    "slack_id": user.slack_id,
                    "name": user.name,
                    "display_name": user.display_name,
                    "real_name": user.real_name,
                    "profile_image_url": user.profile_image_url,
                }
            )

        logger.info(f"Retrieved {len(user_dicts)} users for workspace {workspace_id}")
        return {"users": user_dicts}

    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving user data"
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

        # Prepare safe dates (timezone-naive) for the background task
        safe_start_date = None
        safe_end_date = None

        if date_range and date_range.start_date:
            safe_start_date = (
                date_range.start_date.replace(tzinfo=None)
                if date_range.start_date.tzinfo
                else date_range.start_date
            )

        if date_range and date_range.end_date:
            safe_end_date = (
                date_range.end_date.replace(tzinfo=None)
                if date_range.end_date.tzinfo
                else date_range.end_date
            )

        logger.info(
            f"Using timezone-naive dates for sync: start_date={safe_start_date}, end_date={safe_end_date}"
        )

        # Start the sync process in a background task
        background_tasks.add_task(
            SlackMessageService.sync_channel_messages,
            db=db,
            workspace_id=workspace_id,
            channel_id=channel_id,
            start_date=safe_start_date,
            end_date=safe_end_date,
            include_replies=include_replies,
            batch_size=batch_size,
        )

        return {
            "status": "syncing",
            "message": (
                "Message synchronization started. This process will continue in the background "
                "and may take a few minutes depending on the date range and message volume."
            ),
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


@router.post("/workspaces/{workspace_id}/fix-message-users")
async def fix_message_user_references(
    workspace_id: str,
    channel_id: Optional[str] = Query(None, description="Optional channel ID to fix"),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Fix message user references by extracting user IDs from message text.

    This endpoint scans messages with null user_id but that contain references
    to users in the text (like "<@USER123>: message text") and links them to
    the appropriate SlackUser records.

    Args:
        workspace_id: UUID of the workspace
        channel_id: Optional UUID of a specific channel
        db: Database session

    Returns:
        Dictionary with fix results
    """
    try:
        logger.info(
            f"Fixing message user references for workspace {workspace_id}"
            + (f", channel {channel_id}" if channel_id else ", all channels")
        )

        fixed_count = await SlackMessageService.fix_message_user_references(
            db=db, workspace_id=workspace_id, channel_id=channel_id
        )

        return {
            "status": "success",
            "message": f"Fixed {fixed_count} message user references",
            "fixed_count": fixed_count,
            "workspace_id": workspace_id,
            "channel_id": channel_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fixing message user references: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fixing message user references",
        )


@router.post("/workspaces/{workspace_id}/sync-users-from-messages")
async def sync_users_from_messages(
    workspace_id: str,
    channel_id: Optional[str] = Query(
        None, description="Optional channel ID to process"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Create users from message mentions.

    This endpoint extracts Slack user IDs from messages that mention users
    and creates corresponding SlackUser records in the database.

    Args:
        workspace_id: UUID of the workspace
        channel_id: Optional UUID of a specific channel
        db: Database session

    Returns:
        Dictionary with sync results
    """
    try:
        logger.info(
            f"Syncing users from message mentions for workspace {workspace_id}"
            + (f", channel {channel_id}" if channel_id else ", all channels")
        )

        # First find all messages with user mentions but no user_id
        from sqlalchemy import text  # Import locally to avoid clash with imported modules

        # Build query to find messages with user mentions
        query_conditions = ["m.text LIKE '<@%'", "c.workspace_id = :workspace_id"]
        if channel_id:
            query_conditions.append("m.channel_id = :channel_id")

        query = f"""
        SELECT m.id, m.text, c.workspace_id, c.slack_id as channel_slack_id, w.access_token
        FROM slackmessage m
        JOIN slackchannel c ON m.channel_id = c.id
        JOIN slackworkspace w ON c.workspace_id = w.id
        WHERE {' AND '.join(query_conditions)}
        """

        params = {"workspace_id": workspace_id}
        if channel_id:
            params["channel_id"] = channel_id

        # Execute the query
        result = await db.execute(text(query), params)
        messages = result.fetchall()

        logger.info(f"Found {len(messages)} messages with user mentions")

        import re

        # Pattern to extract user IDs from messages
        pattern = r"<@([A-Z0-9]+)>"

        # Process each message
        created_users = 0
        for message in messages:
            # Extract all user IDs from message text
            matches = re.findall(pattern, message.text)
            for slack_user_id in matches:
                try:
                    # Check if user already exists
                    user_result = await db.execute(
                        text(
                            "SELECT id FROM slackuser WHERE slack_id = :slack_id AND workspace_id = :workspace_id"
                        ),
                        {"slack_id": slack_user_id, "workspace_id": workspace_id},
                    )
                    user = user_result.fetchone()

                    if not user:
                        # Create new user
                        new_user = await SlackMessageService._fetch_and_create_user(
                            db=db,
                            workspace_id=workspace_id,
                            slack_user_id=slack_user_id,
                            access_token=message.access_token,
                        )

                        if new_user:
                            created_users += 1
                            logger.info(
                                f"Created new user: {new_user.name} ({new_user.slack_id})"
                            )
                except Exception as e:
                    logger.error(f"Error creating user {slack_user_id}: {str(e)}")

        # Try to fix message references now that we have created users
        fixed_count = await SlackMessageService.fix_message_user_references(
            db=db, workspace_id=workspace_id, channel_id=channel_id
        )

        return {
            "status": "success",
            "message": f"Created {created_users} users and fixed {fixed_count} message references",
            "created_users": created_users,
            "fixed_references": fixed_count,
            "workspace_id": workspace_id,
            "channel_id": channel_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing users from messages: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while syncing users from messages",
        )


@router.post("/workspaces/{workspace_id}/channels/{channel_id}/sync-threads")
async def sync_thread_replies(
    workspace_id: str,
    channel_id: str,
    days: int = Query(
        7, ge=1, le=30, description="Days of messages to scan for threads"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Sync thread replies for messages in a channel.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        days: Number of days of messages to scan for threads
        db: Database session

    Returns:
        Dictionary with sync results
    """
    try:
        # Find all thread parent messages in the channel within timeframe
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get the channel
        channel_result = await db.execute(
            select(SlackChannel)
            .options(selectinload(SlackChannel.workspace))
            .where(SlackChannel.id == channel_id)
        )
        channel = channel_result.scalars().first()

        if not channel:
            raise HTTPException(
                status_code=404, detail=f"Channel not found: {channel_id}"
            )

        # Get thread parent messages in the timeframe
        parent_result = await db.execute(
            select(SlackMessage).where(
                SlackMessage.channel_id == channel_id,
                SlackMessage.is_thread_parent.is_(True),
                SlackMessage.message_datetime >= start_date,
                SlackMessage.message_datetime <= end_date,
            )
        )
        parents = parent_result.scalars().all()

        if not parents:
            return {
                "status": "success",
                "message": "No thread parent messages found in timeframe",
                "threads_synced": 0,
                "replies_synced": 0,
            }

        # Sync each thread
        total_threads = len(parents)
        total_replies = 0

        for parent in parents:
            # Fetch and store thread replies
            logger.info(
                f"Processing thread {parent.slack_ts} in channel {channel.name}"
            )
            thread_replies = (
                await SlackMessageService._fetch_thread_replies_with_pagination(
                    access_token=channel.workspace.access_token,
                    channel_id=channel.slack_id,
                    thread_ts=parent.slack_ts,
                )
            )

            # Process and store replies
            reply_count = 0
            for reply in thread_replies:
                # Skip if it's the parent message
                if reply.get("ts") == parent.slack_ts:
                    continue

                # Check if reply already exists
                existing_result = await db.execute(
                    select(SlackMessage).where(
                        SlackMessage.channel_id == channel_id,
                        SlackMessage.slack_ts == reply.get("ts"),
                    )
                )
                existing = existing_result.scalars().first()

                if existing:
                    # Skip already stored replies
                    continue

                # Process reply
                reply_data = await SlackMessageService._prepare_message_data(
                    db=db,
                    workspace_id=workspace_id,
                    channel=channel,
                    message=reply,
                )

                # Create new reply
                db_reply = SlackMessage(**reply_data)
                db.add(db_reply)
                reply_count += 1

            if reply_count > 0:
                # Update parent message with latest counts
                parent.reply_count = (
                    len(thread_replies) - 1
                )  # Subtract 1 for parent message
                logger.info(
                    f"Stored {reply_count} replies for thread {parent.slack_ts}"
                )
                total_replies += reply_count

                # Commit changes for this thread
                await db.commit()

        return {
            "status": "success",
            "message": f"Synced {total_replies} replies for {total_threads} threads",
            "threads_synced": total_threads,
            "replies_synced": total_replies,
            "workspace_id": workspace_id,
            "channel_id": channel_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing thread replies: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while syncing thread replies",
        )


@router.get("/workspaces/{workspace_id}/channels/{channel_id}/threads/{thread_ts}")
async def get_thread_replies(
    workspace_id: str,
    channel_id: str,
    thread_ts: str,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get all replies for a specific thread.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        thread_ts: Thread parent timestamp
        limit: Maximum number of replies to retrieve
        db: Database session

    Returns:
        Dictionary with thread parent and replies
    """
    try:
        # Fetch the parent message
        parent_result = await db.execute(
            select(SlackMessage).where(
                SlackMessage.channel_id == channel_id,
                SlackMessage.slack_ts == thread_ts,
            )
        )
        parent = parent_result.scalars().first()

        if not parent:
            raise HTTPException(
                status_code=404, detail=f"Thread parent message not found: {thread_ts}"
            )

        # Fetch replies from database
        replies_result = await db.execute(
            select(SlackMessage)
            .where(
                SlackMessage.channel_id == channel_id,
                SlackMessage.thread_ts == thread_ts,
                SlackMessage.is_thread_reply.is_(True),
            )
            .order_by(SlackMessage.message_datetime)
            .limit(limit)
        )
        replies = replies_result.scalars().all()

        # Format messages for API response
        def format_message(message):
            return {
                "id": str(message.id),
                "slack_id": message.slack_id,
                "slack_ts": message.slack_ts,
                "text": message.text,
                "user_id": str(message.user_id) if message.user_id else None,
                "message_datetime": message.message_datetime.isoformat(),
                "is_thread_parent": message.is_thread_parent,
                "is_thread_reply": message.is_thread_reply,
                "thread_ts": message.thread_ts,
                "reply_count": message.reply_count,
                "reply_users_count": message.reply_users_count,
                "message_type": message.message_type,
                "is_edited": message.is_edited,
            }

        # Build the response
        return {
            "parent": format_message(parent),
            "replies": [format_message(reply) for reply in replies],
            "total_replies": parent.reply_count,
            "has_more": len(replies) < parent.reply_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching thread replies: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching thread replies",
        )
