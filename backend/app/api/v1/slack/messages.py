"""
Slack messages API routes.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, text
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

        # Get messages from database
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

        # Format response for API
        return {
            "messages": result["messages"],
            "pagination": result["pagination"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving messages"
        )


@router.get("/workspaces/{workspace_id}/messages")
async def get_messages_by_date_range(
    workspace_id: str,
    channel_ids: str,  # Comma-separated list of channel IDs
    start_date: Optional[datetime] = Query(
        None, description="Start date for message filtering"
    ),
    end_date: Optional[datetime] = Query(
        None, description="End date for message filtering"
    ),
    include_replies: bool = Query(
        True, description="Whether to include thread replies"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Number of items per page"),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get messages from multiple channels with date range filtering and pagination.

    Args:
        workspace_id: UUID of the workspace
        channel_ids: Comma-separated list of channel IDs to get messages from
        start_date: Optional start date for filtering messages
        end_date: Optional end date for filtering messages
        include_replies: Whether to include thread replies
        page: Page number for pagination
        page_size: Number of items per page
        db: Database session

    Returns:
        Dictionary with messages and pagination information
    """
    try:
        logger.info(
            f"Fetching messages for workspace {workspace_id}, channels: {channel_ids}, "
            f"date range: {start_date} to {end_date}, page: {page}, page_size: {page_size}"
        )

        # Parse channel IDs from comma-separated string
        channel_id_list = [
            ch_id.strip() for ch_id in channel_ids.split(",") if ch_id.strip()
        ]

        # Strip timezone info from datetime objects if present
        safe_start_date = None
        safe_end_date = None

        if start_date:
            safe_start_date = start_date.replace(tzinfo=None)

        if end_date:
            safe_end_date = end_date.replace(tzinfo=None)

        # Get messages by date range
        result = await SlackMessageService.get_messages_by_date_range(
            db=db,
            workspace_id=workspace_id,
            channel_ids=channel_id_list,
            start_date=safe_start_date,
            end_date=safe_end_date,
            include_replies=include_replies,
            page=page,
            page_size=page_size,
        )

        # Format response for API
        return {
            "messages": result["messages"],
            "pagination": result["pagination"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages by date range: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving messages"
        )


@router.get("/workspaces/{workspace_id}/users")
async def get_users(
    workspace_id: str,
    user_ids: List[str] = Query(..., description="List of user UUIDs to retrieve"),
    fetch_from_slack: bool = Query(
        False, description="Whether to fetch users from Slack API if not found in DB"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get user details for a list of user IDs within a workspace.

    Args:
        workspace_id: UUID of the workspace
        user_ids: List of user UUIDs to retrieve
        fetch_from_slack: Whether to fetch users from Slack API if not found in DB
        db: Database session

    Returns:
        Dictionary with user details
    """
    try:
        logger.info(
            f"Fetching user details for workspace {workspace_id}, user_ids: {user_ids}, fetch_from_slack: {fetch_from_slack}"
        )

        # Strip out any empty strings or None values
        valid_user_ids = [user_id for user_id in user_ids if user_id]

        if not valid_user_ids:
            return {"users": []}

        # Import locally to avoid clash with unused import warning
        from app.models.slack import SlackUser, SlackWorkspace

        # Check for Slack IDs (starting with 'U' or 'W')
        slack_user_ids = []
        db_user_ids = []

        for user_id in valid_user_ids:
            if user_id.startswith("U") or user_id.startswith("W"):
                slack_user_ids.append(user_id)
            else:
                db_user_ids.append(user_id)

        users = []

        # Fetch users by database UUID
        if db_user_ids:
            query = select(SlackUser).where(
                SlackUser.id.in_(db_user_ids), SlackUser.workspace_id == workspace_id
            )

            result = await db.execute(query)
            db_users = result.scalars().all()
            users.extend(db_users)

        # Fetch users by Slack ID
        if slack_user_ids:
            query = select(SlackUser).where(
                SlackUser.slack_id.in_(slack_user_ids),
                SlackUser.workspace_id == workspace_id,
            )

            result = await db.execute(query)
            slack_id_users = result.scalars().all()
            users.extend(slack_id_users)

            # Get Slack IDs that weren't found
            found_slack_ids = [user.slack_id for user in slack_id_users]
            missing_slack_ids = [
                sid for sid in slack_user_ids if sid not in found_slack_ids
            ]

            # If fetch_from_slack is True, try to get missing users from Slack API
            if fetch_from_slack and missing_slack_ids:
                logger.info(
                    f"Fetching {len(missing_slack_ids)} missing users from Slack API"
                )

                # Get workspace access token
                workspace_result = await db.execute(
                    select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
                )
                workspace = workspace_result.scalars().first()

                if workspace and workspace.access_token:
                    for slack_id in missing_slack_ids:
                        try:
                            # Fetch and create user
                            new_user = await SlackMessageService._fetch_and_create_user(
                                db=db,
                                workspace_id=workspace_id,
                                slack_user_id=slack_id,
                                access_token=workspace.access_token,
                            )

                            if new_user:
                                users.append(new_user)
                        except Exception as e:
                            logger.error(
                                f"Error fetching user {slack_id} from Slack API: {str(e)}"
                            )

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
        batch_size: Number of messages per process in each batch
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


@router.post("/sync-users-from-messages")
async def sync_users_from_messages(
    workspace_id: Optional[str] = Query(None, description="Optional workspace ID"),
    channel_id: Optional[str] = Query(None, description="Optional channel ID"),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Sync users from messages in the database.

    This endpoint finds all messages with user_slack_id but no user_id,
    fetches user data from Slack API, and creates SlackUser records.

    Args:
        workspace_id: Optional workspace ID to limit scope
        channel_id: Optional channel ID to limit scope
        db: Database session

    Returns:
        Dictionary with sync results
    """
    try:
        # Get messages with user_slack_id but no user_id
        # If workspace_id and/or channel_id provided, limit to that scope
        query = select(SlackMessage).where(
            SlackMessage.user_slack_id.is_not(None), SlackMessage.user_id.is_(None)
        )

        if workspace_id:
            # Join with channel to filter by workspace
            # Import SlackChannel locally to avoid warning
            from app.models.slack import SlackChannel

            subquery = (
                select(SlackChannel.id)
                .where(SlackChannel.workspace_id == workspace_id)
                .scalar_subquery()
            )
            query = query.where(SlackMessage.channel_id.in_(subquery))

        if channel_id:
            query = query.where(SlackMessage.channel_id == channel_id)

        result = await db.execute(query)
        messages = result.scalars().all()

        if not messages:
            return {
                "status": "success",
                "message": "No messages found needing user sync",
                "created_users": 0,
                "fixed_references": 0,
            }

        # Group by workspace_id and user_slack_id to fetch each user once
        user_ids_by_workspace = {}
        for message in messages:
            if not message.channel_id or not message.user_slack_id:
                continue

            # Get the channel to get the workspace
            channel_result = await db.execute(
                select(SlackChannel).where(SlackChannel.id == message.channel_id)
            )
            channel = channel_result.scalars().first()

            if not channel or not channel.workspace_id:
                continue

            if channel.workspace_id not in user_ids_by_workspace:
                user_ids_by_workspace[channel.workspace_id] = set()

            user_ids_by_workspace[channel.workspace_id].add(message.user_slack_id)

        # Fetch and create users
        created_users = 0
        for workspace_id, slack_user_ids in user_ids_by_workspace.items():
            # Get workspace
            # Import SlackWorkspace locally to avoid warning
            from app.models.slack import SlackWorkspace

            workspace_result = await db.execute(
                select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
            )
            workspace = workspace_result.scalars().first()

            if not workspace or not workspace.access_token:
                continue

            # Fetch and create each user
            # API client will be created in the service
            for slack_user_id in slack_user_ids:
                try:
                    # Check if user already exists
                    # Import SlackUser locally to avoid warning
                    from app.models.slack import SlackUser

                    user_result = await db.execute(
                        select(SlackUser).where(
                            SlackUser.workspace_id == workspace_id,
                            SlackUser.slack_id == slack_user_id,
                        )
                    )
                    existing_user = user_result.scalars().first()

                    if existing_user:
                        continue

                    # Fetch user from Slack API
                    user_data = await SlackMessageService._fetch_and_create_user(
                        db=db,
                        workspace_id=workspace_id,
                        slack_user_id=slack_user_id,
                        access_token=workspace.access_token,
                    )

                    if user_data:
                        created_users += 1
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

    # Forward to the unified sync endpoint
    response = await sync_channel_messages(
        workspace_id=workspace_id,
        channel_id=channel_id,
        background_tasks=background_tasks,
        thread_days=days,
        db=db,
        sync_threads=True,
        include_replies=True,
    )

    # Add deprecation notice to the response
    response["deprecated"] = True
    response["message"] = (
        "[DEPRECATED ENDPOINT] "
        + response["message"]
        + " Please use the /sync endpoint with sync_threads=true in the future."
    )

    return response


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

    This endpoint finds thread parent messages (with reply_count > 0),
    fetches thread replies directly from Slack API, and stores them in the database.

    Args:
        channel_id: Optional channel ID to focus on specific channel
        max_threads: Maximum number of threads to process
        db: Database session

    Returns:
        Dictionary with fix results
    """
    try:
        logger.info("Fixing thread replies by loading from Slack API")

        # Find thread parent messages
        query = select(SlackMessage).where(
            SlackMessage.is_thread_parent.is_(True), SlackMessage.reply_count > 0
        )

        if channel_id:
            query = query.where(SlackMessage.channel_id == channel_id)

        # Limit to recent messages first and cap the total number
        query = query.order_by(SlackMessage.message_datetime.desc()).limit(max_threads)

        result = await db.execute(query)
        thread_parents = result.scalars().all()

        if not thread_parents:
            return {
                "status": "success",
                "message": "No thread parent messages found",
                "threads_processed": 0,
                "replies_added": 0,
            }

        # Process each thread
        threads_processed = 0
        replies_added = 0

        for parent in thread_parents:
            try:
                # Get the channel
                channel_result = await db.execute(
                    select(SlackChannel)
                    .options(selectinload(SlackChannel.workspace))
                    .where(SlackChannel.id == parent.channel_id)
                )
                channel = channel_result.scalars().first()

                if not channel or not channel.workspace:
                    logger.warning(f"Channel not found for message {parent.id}")
                    continue

                # Fetch thread replies
                thread_replies = (
                    await SlackMessageService._fetch_thread_replies_with_pagination(
                        access_token=channel.workspace.access_token,
                        channel_id=channel.slack_id,
                        thread_ts=parent.slack_ts,
                    )
                )

                # Process replies
                thread_reply_count = 0
                for reply in thread_replies:
                    # Skip parent message
                    if reply.get("ts") == parent.slack_ts:
                        continue

                    # Check if reply already exists
                    existing_reply = await db.execute(
                        select(SlackMessage).where(
                            SlackMessage.channel_id == parent.channel_id,
                            SlackMessage.slack_ts == reply.get("ts"),
                        )
                    )
                    if existing_reply.scalar_one_or_none():
                        continue

                    # Process and store reply
                    reply_data = await SlackMessageService._prepare_message_data(
                        db=db,
                        workspace_id=channel.workspace_id,
                        channel=channel,
                        message=reply,
                    )

                    new_reply = SlackMessage(**reply_data)
                    db.add(new_reply)
                    thread_reply_count += 1

                if thread_reply_count > 0:
                    # Commit after each thread with new replies
                    await db.commit()
                    replies_added += thread_reply_count

                threads_processed += 1

            except Exception as e:
                logger.error(f"Error processing thread {parent.slack_ts}: {str(e)}")
                await db.rollback()

        return {
            "status": "success",
            "message": f"Fixed {replies_added} thread replies across {threads_processed} threads",
            "threads_processed": threads_processed,
            "replies_added": replies_added,
        }

    except Exception as e:
        logger.error(f"Error fixing thread replies: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500, detail="An error occurred while fixing thread replies"
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

        # Check for discrepancy between expected and actual reply count
        if len(replies) < parent.reply_count:
            logger.info(
                f"Thread {thread_ts} has {parent.reply_count} expected replies, but found {len(replies)} in database"
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
            logger.info(
                f"Fetching thread {thread_ts} from Slack API (force_refresh={force_refresh})"
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
                        except Exception as e:
                            # Log but don't fail if we can't save a reply
                            logger.error(f"Error saving reply to database: {str(e)}")

                    logger.info(
                        f"Fetched {len(api_formatted_replies)} replies from Slack API"
                    )

                    # Try to commit any database changes
                    try:
                        await db.commit()
                        logger.info("Thread replies saved to database")
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
                        "has_more": False,  # We got all replies from API
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
