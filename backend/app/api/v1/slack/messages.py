"""
Slack messages API routes.
"""

import logging
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_async_db
from app.models.slack import SlackChannel, SlackMessage
from app.services.slack.api import SlackApiClient
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
        True, description="Whether to include thread replies during message sync"
    ),
    sync_threads: bool = Query(
        True, description="Whether to sync thread replies after message sync"
    ),
    thread_days: int = Query(
        30, ge=1, le=90, description="Number of days of thread messages to sync"
    ),
    batch_size: int = Query(
        200, ge=50, le=1000, description="Number of messages per batch"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Sync messages and thread replies from a Slack channel to the database.

    This endpoint initiates a background task for syncing both regular messages and thread replies.
    It returns immediately with a status message while the sync continues in the background.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        date_range: Optional date range for filtering messages
        background_tasks: FastAPI background tasks handler
        include_replies: Whether to include thread replies during message sync
        sync_threads: Whether to sync thread replies after message sync
        thread_days: Number of days of thread messages to sync
        batch_size: Number of messages to process in each batch
        db: Database session

    Returns:
        Dictionary with status information
    """
    try:
        logger.info(
            f"Initiating message & thread sync for channel {channel_id} in workspace {workspace_id}, "
            f"date range: {date_range.start_date if date_range else None} to "
            f"{date_range.end_date if date_range else None}, batch_size: {batch_size}, "
            f"sync_threads: {sync_threads}, thread_days: {thread_days}"
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
            sync_threads=sync_threads,
            thread_days=thread_days,
            batch_size=batch_size,
        )

        msg_type = "Message & thread" if sync_threads else "Message"
        return {
            "status": "syncing",
            "message": (
                f"{msg_type} synchronization started. This process will continue in the background "
                "and may take a few minutes depending on the date range and message volume."
            ),
            "workspace_id": workspace_id,
            "channel_id": channel_id,
            "sync_threads": sync_threads,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating message sync: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while initiating message sync"
        )


@router.post("/fix-thread-parent-flags")
async def fix_thread_parent_flags(
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Fix thread parent flags for all messages in the database.

    This endpoint updates all messages to correctly mark thread parents based
    on the logic that a message is a thread parent if:
    1. It has replies (reply_count > 0) AND
    2. Either thread_ts equals its own ts (it started a thread) OR thread_ts is None

    Returns:
        Dictionary with fix results
    """
    try:
        logger.info("Fixing thread parent flags for all messages")

        # Use a direct SQL update for efficiency
        sql = """
        UPDATE slackmessage 
        SET is_thread_parent = TRUE
        WHERE reply_count > 0 
          AND (thread_ts = slack_ts OR thread_ts IS NULL)
          AND is_thread_parent = FALSE
        """

        result = await db.execute(text(sql))
        updated_count = result.rowcount
        await db.commit()

        logger.info(f"Fixed {updated_count} thread parent flags")

        return {
            "status": "success",
            "message": f"Fixed {updated_count} thread parent flags",
            "updated_count": updated_count,
        }

    except Exception as e:
        logger.error(f"Error fixing thread parent flags: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fixing thread parent flags",
        )


@router.post("/fix-thread-replies")
async def fix_thread_replies(
    channel_id: Optional[str] = Query(
        None, description="Optional channel ID to focus on"
    ),
    max_threads: int = Query(
        50, ge=1, le=200, description="Maximum number of threads to process"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Fix thread replies by directly loading thread data from Slack API.

    This endpoint processes existing thread parent messages and ensures
    all replies are correctly loaded from Slack API into the database.

    Args:
        channel_id: Optional channel ID to process
        max_threads: Maximum number of threads to process
        db: Database session

    Returns:
        Dictionary with fix results
    """
    try:
        logger.info(f"Starting thread reply fix for {max_threads} threads")

        # Get all thread parent messages
        query = select(SlackMessage).where(
            SlackMessage.is_thread_parent.is_(True), SlackMessage.reply_count > 0
        )

        # If channel ID is provided, limit to that channel
        if channel_id:
            query = query.where(SlackMessage.channel_id == channel_id)

        # Limit the number of threads to process
        query = query.limit(max_threads)

        # Execute the query
        result = await db.execute(query)
        parent_messages = result.scalars().all()

        logger.info(f"Found {len(parent_messages)} thread parent messages to fix")

        # Track the number of threads and replies processed
        threads_processed = 0
        total_replies_added = 0

        # Process each thread parent message
        for parent in parent_messages:
            threads_processed += 1
            logger.info(
                f"Processing thread {threads_processed}/{len(parent_messages)}: {parent.slack_ts}"
            )

            # Get the channel info for this message
            channel_result = await db.execute(
                select(SlackChannel)
                .options(selectinload(SlackChannel.workspace))
                .where(SlackChannel.id == parent.channel_id)
            )
            channel = channel_result.scalars().first()

            if not channel:
                logger.warning(f"Channel not found for message {parent.id}, skipping")
                continue

            if not channel.workspace.access_token:
                logger.warning(
                    f"No access token for workspace {channel.workspace.id}, skipping"
                )
                continue

            # Fetch full thread from Slack API
            try:
                thread_replies = await SlackMessageService._fetch_thread_replies_with_pagination(
                    access_token=channel.workspace.access_token,
                    channel_id=channel.slack_id,
                    thread_ts=parent.slack_ts,
                    limit=500,  # Fetch up to 500 replies per page
                    max_pages=20,  # Maximum 20 pages (10,000 replies should be enough)
                )

                logger.info(
                    f"Fetched {len(thread_replies)} replies for thread {parent.slack_ts}"
                )

                # Process and store each reply
                replies_added = 0
                for reply in thread_replies:
                    # Skip if it's the parent message (which is included in replies)
                    if reply.get("ts") == parent.slack_ts:
                        continue

                    # Check if this reply already exists in the database
                    existing_result = await db.execute(
                        select(SlackMessage).where(
                            SlackMessage.channel_id == parent.channel_id,
                            SlackMessage.slack_ts == reply.get("ts"),
                        )
                    )
                    existing_reply = existing_result.scalars().first()

                    if existing_reply:
                        # Update the existing reply if needed
                        if not existing_reply.is_thread_reply:
                            existing_reply.is_thread_reply = True
                            existing_reply.thread_ts = parent.slack_ts
                            existing_reply.parent_id = parent.id
                            replies_added += 1
                            logger.info(f"Updated existing reply {reply.get('ts')}")
                    else:
                        # Create new reply
                        reply_data = await SlackMessageService._prepare_message_data(
                            db=db,
                            workspace_id=channel.workspace.id,
                            channel=channel,
                            message=reply,
                        )

                        # Force thread reply properties
                        reply_data["is_thread_reply"] = True
                        reply_data["thread_ts"] = parent.slack_ts
                        reply_data["parent_id"] = parent.id

                        # Create new message for the reply
                        db_reply = SlackMessage(**reply_data)
                        db.add(db_reply)
                        replies_added += 1
                        logger.info(f"Added new reply {reply.get('ts')}")

                # Update parent message with reply count
                parent.reply_count = (
                    len(thread_replies) - 1
                )  # Subtract 1 for parent message

                # Commit changes for this thread
                if replies_added > 0:
                    await db.commit()
                    total_replies_added += replies_added
                    logger.info(
                        f"Added/updated {replies_added} replies for thread {parent.slack_ts}"
                    )

            except Exception as e:
                logger.error(f"Error processing thread {parent.slack_ts}: {e}")
                await db.rollback()

        return {
            "status": "success",
            "message": f"Fixed {total_replies_added} thread replies across {threads_processed} threads",
            "threads_processed": threads_processed,
            "replies_added": total_replies_added,
        }

    except Exception as e:
        logger.error(f"Error fixing thread replies: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500, detail="An error occurred while fixing thread replies"
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
        channel_info = f", channel {channel_id}" if channel_id else ", all channels"
        logger.info(
            f"Syncing users from message mentions for workspace {workspace_id}{channel_info}"
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
        30, ge=1, le=90, description="Days of messages to scan for threads"
    ),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    [DEPRECATED] Sync thread replies for messages in a channel.
    Use the /sync endpoint with sync_threads=true parameter instead.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        days: Number of days of messages to scan for threads
        background_tasks: FastAPI background tasks handler
        db: Database session

    Returns:
        Dictionary with sync results
    """
    # Log deprecation warning
    logger.warning(
        "Using deprecated sync-threads endpoint. Use /sync with sync_threads=true instead."
    )

    try:
        # Call the new unified sync endpoint's functionality
        background_tasks.add_task(
            SlackMessageService.sync_channel_messages,
            db=db,
            workspace_id=workspace_id,
            channel_id=channel_id,
            # Don't sync messages, only threads
            start_date=None,
            end_date=None,
            include_replies=True,
            sync_threads=True,
            thread_days=days,
            batch_size=200,
        )

        return {
            "status": "syncing",
            "message": (
                "[DEPRECATED ENDPOINT] Thread synchronization started. "
                "This process will continue in the background. "
                "Please use the /sync endpoint with sync_threads=true in the future."
            ),
            "workspace_id": workspace_id,
            "channel_id": channel_id,
            "threads_synced": 0,  # Will be determined during background processing
            "replies_synced": 0,  # Will be determined during background processing
            "deprecated": True,
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
    force_refresh: bool = Query(
        False, description="Force refreshing data from Slack API"
    ),
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

        # Log what's happening for debugging
        logger.info(
            f"Thread {thread_ts} has {parent.reply_count} replies, but found {len(replies)} in database"
        )

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

        # If force_refresh is enabled or we don't have enough replies in the database, fetch directly from Slack API
        if force_refresh or (
            len(replies) < parent.reply_count and parent.reply_count > 0
        ):
            if force_refresh:
                logger.info(
                    f"Force refresh requested. Fetching directly from Slack API for thread {thread_ts}"
                )
            else:
                logger.info(
                    f"Not enough replies in database. Fetching from Slack API for thread {thread_ts}"
                )

            # Get the channel
            channel_result = await db.execute(
                select(SlackChannel)
                .options(selectinload(SlackChannel.workspace))
                .where(SlackChannel.id == channel_id)
            )
            channel = channel_result.scalars().first()

            if channel and channel.workspace:
                try:
                    # Fetch directly from Slack API
                    api_replies = (
                        await SlackMessageService._fetch_thread_replies_with_pagination(
                            access_token=channel.workspace.access_token,
                            channel_id=channel.slack_id,
                            thread_ts=thread_ts,
                            limit=limit,
                        )
                    )

                    # Process replies (excluding parent)
                    api_formatted_replies = []
                    for reply in api_replies:
                        # Skip the parent message
                        if reply.get("ts") == thread_ts:
                            continue

                        # Format reply for API response
                        api_formatted_replies.append(
                            {
                                "id": "temp-" + reply.get("ts", ""),  # Temporary ID
                                "slack_id": reply.get("client_msg_id", ""),
                                "slack_ts": reply.get("ts", ""),
                                "text": reply.get("text", ""),
                                "user_id": reply.get(
                                    "user", ""
                                ),  # Note: This is Slack user ID, not DB user ID
                                "message_datetime": datetime.fromtimestamp(
                                    float(reply.get("ts", 0))
                                ).isoformat(),
                                "is_thread_parent": False,
                                "is_thread_reply": True,
                                "thread_ts": thread_ts,
                                "reply_count": 0,
                                "reply_users_count": 0,
                                "message_type": "message",
                                "is_edited": "edited" in reply,
                            }
                        )

                        # Also try to save this reply to the database if it doesn't exist
                        try:
                            # Check if reply already exists
                            existing_reply_result = await db.execute(
                                select(SlackMessage).where(
                                    SlackMessage.channel_id == channel_id,
                                    SlackMessage.slack_ts == reply.get("ts", ""),
                                )
                            )
                            existing_reply = existing_reply_result.scalars().first()

                            if not existing_reply:
                                # Create and save the reply to the database
                                logger.info(
                                    f"Saving newly discovered reply {reply.get('ts')} to database"
                                )

                                # Prepare reply data
                                reply_data = {
                                    "slack_id": reply.get("client_msg_id", ""),
                                    "slack_ts": reply.get("ts", ""),
                                    "thread_ts": thread_ts,
                                    "text": reply.get("text", ""),
                                    "channel_id": channel_id,
                                    "is_thread_parent": False,
                                    "is_thread_reply": True,
                                    "message_type": "message",
                                    "is_edited": "edited" in reply,
                                    "message_datetime": datetime.fromtimestamp(
                                        float(reply.get("ts", 0))
                                    ),
                                }

                                # Create and save the new reply
                                db_reply = SlackMessage(**reply_data)
                                db.add(db_reply)

                                # Don't wait for the commit - we'll commit after processing all replies
                                logger.info(
                                    f"Added reply {reply.get('ts')} to database session"
                                )
                        except Exception as e:
                            # Log but don't fail if we can't save a reply
                            logger.error(f"Error saving reply to database: {str(e)}")

                    logger.info(
                        f"Fetched {len(api_formatted_replies)} replies directly from Slack API"
                    )

                    # Try to commit any database changes
                    try:
                        await db.commit()
                        logger.info(
                            "Successfully committed thread reply changes to database"
                        )
                    except Exception as e:
                        logger.error(
                            f"Error committing thread replies to database: {str(e)}"
                        )
                        await db.rollback()

                    # Build the response with API replies
                    return {
                        "parent": format_message(parent),
                        "replies": api_formatted_replies,
                        "total_replies": parent.reply_count,
                        "has_more": False,  # We got all replies directly from API
                        "note": "Replies fetched directly from Slack API",
                    }
                except Exception as e:
                    logger.error(
                        f"Error fetching thread replies from Slack API: {str(e)}"
                    )
                    # Continue with database replies if API fetch fails

        # Build the response with database replies
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


@router.get(
    "/workspaces/{workspace_id}/channels/{channel_id}/direct-thread/{thread_ts}"
)
async def direct_thread_replies(
    workspace_id: str,
    channel_id: str,
    thread_ts: str,
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Direct endpoint to get thread replies from Slack API without any processing.
    This is for debugging purposes.

    Args:
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel
        thread_ts: Thread parent timestamp
        db: Database session

    Returns:
        Raw response from Slack API
    """
    try:
        # Get the channel and workspace
        channel_result = await db.execute(
            select(SlackChannel)
            .options(selectinload(SlackChannel.workspace))
            .where(SlackChannel.id == channel_id)
        )
        channel = channel_result.scalars().first()

        if not channel or not channel.workspace:
            raise HTTPException(
                status_code=404,
                detail=f"Channel not found or not linked to a workspace: {channel_id}",
            )

        # Create API client
        client = SlackApiClient(channel.workspace.access_token)

        # Direct API call
        logger.info(f"Making direct API call to Slack for thread {thread_ts}")
        response = await client.get_thread_replies(
            channel_id=channel.slack_id,
            thread_ts=thread_ts,
            limit=1000,
            inclusive=True,
        )

        # Return raw API response
        return {
            "status": "success",
            "request": {
                "channel_id": channel.slack_id,
                "thread_ts": thread_ts,
                "workspace_id": workspace_id,
            },
            "response": response,
        }

    except Exception as e:
        logger.error(f"Error in direct thread API: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "thread_ts": thread_ts,
        }
