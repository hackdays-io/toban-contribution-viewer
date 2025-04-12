"""
Slack message retrieval and processing service.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackChannel, SlackMessage, SlackUser, SlackWorkspace
from app.services.slack.api import SlackApiClient, SlackApiError, SlackApiRateLimitError

# Configure logging
logger = logging.getLogger(__name__)


class SlackMessageService:
    """
    Service for retrieving, processing, and storing Slack messages.
    """

    @staticmethod
    async def get_channel_messages(
        db: AsyncSession,
        workspace_id: str,
        channel_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        cursor: Optional[str] = None,
        include_replies: bool = True,
    ) -> Dict[str, Any]:
        """
        Get messages from a channel with pagination, optionally filtered by date range.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_id: UUID of the channel
            start_date: Optional start date for filtering messages
            end_date: Optional end date for filtering messages
            limit: Maximum number of messages to fetch per page
            cursor: Pagination cursor (message timestamp)
            include_replies: Whether to include thread replies

        Returns:
            Dictionary with messages and pagination information
        """
        # Verify workspace exists and get access token
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        if not workspace.access_token:
            logger.error(f"Workspace has no access token: {workspace_id}")
            raise HTTPException(
                status_code=400, detail="Workspace is not properly connected"
            )

        # Verify channel exists
        channel_result = await db.execute(
            select(SlackChannel).where(
                SlackChannel.id == channel_id,
                SlackChannel.workspace_id == workspace_id,
            )
        )
        channel = channel_result.scalars().first()

        if not channel:
            logger.error(f"Channel not found: {channel_id}")
            raise HTTPException(status_code=404, detail="Channel not found")

        # First check if we already have messages for this channel in the database
        query = (
            select(SlackMessage)
            .where(SlackMessage.channel_id == channel_id)
            .order_by(SlackMessage.message_datetime.desc())
        )

        # Apply date filtering if specified, handling timezone-aware datetimes
        if start_date:
            # Dates should already be timezone-naive at this point from the API layer
            # But we'll check again just to be sure
            if hasattr(start_date, "tzinfo") and start_date.tzinfo:
                logger.warning(
                    "start_date still has tzinfo, converting to naive datetime"
                )
                naive_start_date = start_date.replace(tzinfo=None)
            else:
                naive_start_date = start_date

            query = query.where(SlackMessage.message_datetime >= naive_start_date)

        if end_date:
            # Dates should already be timezone-naive at this point from the API layer
            # But we'll check again just to be sure
            if hasattr(end_date, "tzinfo") and end_date.tzinfo:
                logger.warning(
                    "end_date still has tzinfo, converting to naive datetime"
                )
                naive_end_date = end_date.replace(tzinfo=None)
            else:
                naive_end_date = end_date

            query = query.where(SlackMessage.message_datetime <= naive_end_date)

        # Apply pagination
        query = query.limit(limit)

        # Execute query
        result = await db.execute(query)
        messages = result.scalars().all()

        # If we have no messages, or start date is earlier than oldest message,
        # fetch from Slack API

        # Ensure start_date is timezone-naive for comparison with message_datetime
        safe_start_date = None
        if start_date:
            if hasattr(start_date, "tzinfo") and start_date.tzinfo:
                logger.warning(
                    "start_date has tzinfo during comparison, converting to naive"
                )
                safe_start_date = start_date.replace(tzinfo=None)
            else:
                safe_start_date = start_date

        should_fetch_from_api = len(messages) == 0 or (
            start_date
            and (
                not channel.oldest_synced_ts
                or safe_start_date < messages[-1].message_datetime
            )
        )

        if should_fetch_from_api:
            # Create API client
            api_client = SlackApiClient(workspace.access_token)

            # Fetch messages from Slack API
            api_messages, has_more, next_cursor = (
                await SlackMessageService._fetch_messages_from_api(
                    api_client=api_client,
                    channel_id=channel.slack_id,
                    start_date=start_date,
                    end_date=end_date,
                    limit=limit,
                    cursor=cursor,
                )
            )

            # Store fetched messages in database
            if api_messages:
                await SlackMessageService._store_messages(
                    db=db,
                    workspace_id=workspace_id,
                    channel=channel,
                    messages=api_messages,
                    include_replies=include_replies,
                )

                # Update channel sync status
                oldest_ts = (
                    min([msg.get("ts", "0") for msg in api_messages])
                    if api_messages
                    else None
                )
                latest_ts = (
                    max([msg.get("ts", "0") for msg in api_messages])
                    if api_messages
                    else None
                )

                # Only update if we have messages and the timestamps are valid
                if oldest_ts and latest_ts:
                    if (
                        not channel.oldest_synced_ts
                        or oldest_ts < channel.oldest_synced_ts
                    ):
                        channel.oldest_synced_ts = oldest_ts
                    if (
                        not channel.latest_synced_ts
                        or latest_ts > channel.latest_synced_ts
                    ):
                        channel.latest_synced_ts = latest_ts

                channel.last_sync_at = datetime.utcnow()
                await db.commit()

                # Re-fetch messages from database to include the newly stored ones
                query = (
                    select(SlackMessage)
                    .where(SlackMessage.channel_id == channel_id)
                    .order_by(SlackMessage.message_datetime.desc())
                )

                if start_date:
                    query = query.where(SlackMessage.message_datetime >= start_date)
                if end_date:
                    query = query.where(SlackMessage.message_datetime <= end_date)

                query = query.limit(limit)
                result = await db.execute(query)
                messages = result.scalars().all()

            # Prepare pagination info
            pagination = {
                "has_more": has_more,
                "next_cursor": next_cursor,
                "page_size": limit,
                "total_messages": len(messages),
            }
        else:
            # Just use database pagination
            pagination = {
                "has_more": len(messages) == limit,
                "next_cursor": None,  # We'll implement database pagination later
                "page_size": limit,
                "total_messages": len(messages),
            }

        # Convert messages to dictionaries
        message_dicts = [SlackMessageService._message_to_dict(msg) for msg in messages]

        return {
            "messages": message_dicts,
            "pagination": pagination,
        }

    @staticmethod
    async def _fetch_messages_from_api(
        api_client: SlackApiClient,
        channel_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        cursor: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], bool, Optional[str]]:
        """
        Fetch messages from Slack API with pagination and date filtering.

        Args:
            api_client: SlackApiClient instance
            channel_id: Slack ID of the channel
            start_date: Optional start date for filtering messages
            end_date: Optional end date for filtering messages
            limit: Maximum number of messages to fetch
            cursor: Pagination cursor

        Returns:
            Tuple of (messages, has_more, next_cursor)
        """
        # Prepare parameters for conversations.history
        params = {
            "channel": channel_id,
            "limit": min(limit, 1000),  # Enforce Slack API limit
        }

        # Add cursor if provided
        if cursor:
            params["cursor"] = cursor

        # Add date filtering if specified
        if start_date:
            # Convert datetime to Slack timestamp (seconds since epoch)
            params["oldest"] = str(start_date.timestamp())
        if end_date:
            # Convert datetime to Slack timestamp (seconds since epoch)
            params["latest"] = str(end_date.timestamp())

        try:
            # Fetch messages from Slack API
            logger.info(f"Fetching messages from Slack API for channel {channel_id}")
            response = await api_client._make_request(
                "GET", "conversations.history", params=params
            )

            # Extract messages and pagination info
            messages = response.get("messages", [])
            has_more = response.get("has_more", False)
            next_cursor = response.get("response_metadata", {}).get("next_cursor")

            logger.info(
                f"Fetched {len(messages)} messages from Slack API for channel {channel_id}"
            )
            return messages, has_more, next_cursor

        except SlackApiRateLimitError as e:
            logger.warning(
                f"Rate limited when fetching messages for channel {channel_id}. "
                f"Retry after {e.retry_after} seconds."
            )
            # Implement retry logic here if needed
            return [], False, None

        except SlackApiError as e:
            logger.error(f"Error fetching messages from Slack API: {str(e)}")
            # For now, just return empty results
            return [], False, None

    @staticmethod
    async def _store_messages(
        db: AsyncSession,
        workspace_id: str,
        channel: SlackChannel,
        messages: List[Dict[str, Any]],
        include_replies: bool = True,
    ) -> None:
        """
        Store messages from Slack API in the database.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel: SlackChannel instance
            messages: List of messages from Slack API
            include_replies: Whether to fetch and store thread replies
        """
        # Track parent threads to fetch replies for
        thread_ts_set: Set[str] = set()
        stored_message_count = 0

        # Process and store each message
        for message in messages:
            # Skip messages without a timestamp
            if "ts" not in message:
                continue

            # Check if message already exists in database
            existing_message = await db.execute(
                select(SlackMessage).where(
                    SlackMessage.channel_id == channel.id,
                    SlackMessage.slack_ts == message["ts"],
                )
            )
            if existing_message.scalars().first():
                # Skip if already exists
                continue

            # Prepare message data
            message_data = await SlackMessageService._prepare_message_data(
                db=db,
                workspace_id=workspace_id,
                channel=channel,
                message=message,
            )

            # Create new message
            db_message = SlackMessage(**message_data)
            db.add(db_message)
            stored_message_count += 1

            # Track threads to fetch replies for
            if include_replies and message.get("thread_ts") and message.get("replies"):
                thread_ts_set.add(message["thread_ts"])

        # Commit the changes
        await db.commit()
        logger.info(
            f"Stored {stored_message_count} messages for channel {channel.name}"
        )

        # TODO: Implement thread reply fetching based on thread_ts_set

    @staticmethod
    async def _prepare_message_data(
        db: AsyncSession,
        workspace_id: str,
        channel: SlackChannel,
        message: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Process a message from Slack API and prepare data for database storage.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel: SlackChannel instance
            message: Message data from Slack API

        Returns:
            Dictionary with processed message data ready for database storage
        """
        # Extract basic message data
        slack_ts = message["ts"]
        text = message.get("text", "")
        user_id = message.get("user")

        # Convert Slack timestamp to datetime
        message_datetime = datetime.fromtimestamp(float(slack_ts))

        # Determine if message is part of a thread
        thread_ts = message.get("thread_ts")
        is_thread_parent = thread_ts is None and message.get("reply_count", 0) > 0
        is_thread_reply = thread_ts is not None and thread_ts != slack_ts

        # Handle threading
        parent_id = None
        if is_thread_reply and thread_ts:
            # Find parent message
            parent_result = await db.execute(
                select(SlackMessage).where(
                    SlackMessage.channel_id == channel.id,
                    SlackMessage.slack_ts == thread_ts,
                )
            )
            parent_message = parent_result.scalars().first()
            if parent_message:
                parent_id = parent_message.id

        # Get user record if user_id is available
        db_user_id = None
        if user_id:
            user_result = await db.execute(
                select(SlackUser).where(
                    SlackUser.workspace_id == workspace_id,
                    SlackUser.slack_id == user_id,
                )
            )
            user = user_result.scalars().first()
            if user:
                db_user_id = user.id

        # Extract message metadata
        message_type = "message"
        subtype = message.get("subtype")

        # Check for editing
        is_edited = "edited" in message
        edited_ts = message.get("edited", {}).get("ts")

        # Check for attachments and files
        attachments = message.get("attachments")
        files = message.get("files")
        has_attachments = bool(attachments or files)

        # Threading counts
        reply_count = message.get("reply_count", 0)
        reply_users_count = message.get("reply_users_count", 0)

        # Reactions count
        reactions = message.get("reactions", [])
        reaction_count = sum(r.get("count", 0) for r in reactions)

        # Create message data dictionary
        message_data = {
            "slack_id": message.get(
                "client_msg_id", slack_ts
            ),  # Use client_msg_id if available
            "slack_ts": slack_ts,
            "text": text,
            "processed_text": text,  # We'll process mentions later
            "message_type": message_type,
            "subtype": subtype,
            "is_edited": is_edited,
            "edited_ts": edited_ts,
            "has_attachments": has_attachments,
            "attachments": attachments,
            "files": files,
            "thread_ts": thread_ts,
            "is_thread_parent": is_thread_parent,
            "is_thread_reply": is_thread_reply,
            "reply_count": reply_count,
            "reply_users_count": reply_users_count,
            "reaction_count": reaction_count,
            "message_datetime": message_datetime,
            "is_analyzed": False,
            "channel_id": channel.id,
            "user_id": db_user_id,
            "parent_id": parent_id,
        }

        return message_data

    @staticmethod
    def _message_to_dict(message: SlackMessage) -> Dict[str, Any]:
        """
        Convert a database message model to a dictionary.

        Args:
            message: SlackMessage instance

        Returns:
            Dictionary with message data
        """
        return {
            "id": str(message.id),
            "slack_id": message.slack_id,
            "slack_ts": message.slack_ts,
            "text": message.text,
            "message_type": message.message_type,
            "subtype": message.subtype,
            "is_edited": message.is_edited,
            "edited_ts": message.edited_ts,
            "has_attachments": message.has_attachments,
            "thread_ts": message.thread_ts,
            "is_thread_parent": message.is_thread_parent,
            "is_thread_reply": message.is_thread_reply,
            "reply_count": message.reply_count,
            "reply_users_count": message.reply_users_count,
            "reaction_count": message.reaction_count,
            "message_datetime": (
                message.message_datetime.isoformat()
                if message.message_datetime
                else None
            ),
            "channel_id": str(message.channel_id),
            "user_id": str(message.user_id) if message.user_id else None,
            "parent_id": str(message.parent_id) if message.parent_id else None,
        }

    @staticmethod
    async def get_messages_by_date_range(
        db: AsyncSession,
        workspace_id: str,
        channel_ids: List[str],
        start_date: datetime,
        end_date: datetime,
        page: int = 1,
        page_size: int = 100,
    ) -> Dict[str, Any]:
        """
        Get messages from multiple channels filtered by date range with pagination.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_ids: List of channel UUIDs
            start_date: Start date for filtering messages
            end_date: End date for filtering messages
            page: Page number for pagination
            page_size: Number of messages per page

        Returns:
            Dictionary with messages and pagination information
        """
        # Verify workspace exists
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        # Verify channels exist
        channels_result = await db.execute(
            select(SlackChannel).where(
                SlackChannel.id.in_(channel_ids),
                SlackChannel.workspace_id == workspace_id,
            )
        )
        channels = channels_result.scalars().all()

        if len(channels) != len(channel_ids):
            logger.error(f"Some channels not found in workspace {workspace_id}")
            raise HTTPException(status_code=404, detail="Some channels not found")

        # Convert timezone-aware datetimes to naive for database compatibility
        naive_start_date = (
            start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        )
        naive_end_date = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date

        # Query messages from database
        query = (
            select(SlackMessage)
            .where(
                SlackMessage.channel_id.in_(channel_ids),
                SlackMessage.message_datetime >= naive_start_date,
                SlackMessage.message_datetime <= naive_end_date,
            )
            .order_by(SlackMessage.message_datetime.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        # Execute query
        result = await db.execute(query)
        messages = result.scalars().all()

        # Count total messages for pagination
        count_query = select(SlackMessage).where(
            SlackMessage.channel_id.in_(channel_ids),
            SlackMessage.message_datetime >= naive_start_date,
            SlackMessage.message_datetime <= naive_end_date,
        )
        count_result = await db.execute(count_query)
        total_count = len(count_result.scalars().all())

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_prev = page > 1

        # Convert messages to dictionaries
        message_dicts = [SlackMessageService._message_to_dict(msg) for msg in messages]

        return {
            "messages": message_dicts,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "total_items": total_count,
                "has_next": has_next,
                "has_prev": has_prev,
            },
        }

    @staticmethod
    async def sync_channel_messages(
        db: AsyncSession,
        workspace_id: str,
        channel_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_replies: bool = True,
        batch_size: int = 200,
    ) -> Dict[str, Any]:
        """
        Sync messages from a Slack channel to the database.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_id: UUID of the channel
            start_date: Optional start date for filtering messages
            end_date: Optional end date for filtering messages
            include_replies: Whether to include thread replies
            batch_size: Number of messages to process in each batch

        Returns:
            Dictionary with sync results
        """
        # Verify workspace exists and get access token
        workspace_result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        workspace = workspace_result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        if not workspace.access_token:
            logger.error(f"Workspace has no access token: {workspace_id}")
            raise HTTPException(
                status_code=400, detail="Workspace is not properly connected"
            )

        # Verify channel exists
        channel_result = await db.execute(
            select(SlackChannel).where(
                SlackChannel.id == channel_id,
                SlackChannel.workspace_id == workspace_id,
            )
        )
        channel = channel_result.scalars().first()

        if not channel:
            logger.error(f"Channel not found: {channel_id}")
            raise HTTPException(status_code=404, detail="Channel not found")

        # Create API client
        api_client = SlackApiClient(workspace.access_token)

        # Track sync progress
        processed_count = 0
        new_message_count = 0
        updated_message_count = 0
        error_count = 0
        has_more = True
        next_cursor = None

        start_time = time.time()

        # Fetch messages in batches
        while has_more:
            try:
                # Fetch messages from Slack API
                messages, has_more, next_cursor = (
                    await SlackMessageService._fetch_messages_from_api(
                        api_client=api_client,
                        channel_id=channel.slack_id,
                        start_date=start_date,
                        end_date=end_date,
                        limit=batch_size,
                        cursor=next_cursor,
                    )
                )

                if not messages:
                    break

                processed_count += len(messages)

                # Store messages in database
                stored_before = new_message_count
                await SlackMessageService._store_messages(
                    db=db,
                    workspace_id=workspace_id,
                    channel=channel,
                    messages=messages,
                    include_replies=include_replies,
                )

                # Update counts
                new_result = await db.execute(
                    select(SlackMessage).where(
                        SlackMessage.channel_id == channel_id,
                        SlackMessage.created_at
                        > datetime.utcnow() - timedelta(minutes=5),
                    )
                )
                new_messages = new_result.scalars().all()
                new_message_count = len(new_messages)

                # Calculate new messages based on difference from before this batch
                new_in_batch = new_message_count - stored_before

                logger.info(
                    f"Processed batch of {len(messages)} messages, stored {new_in_batch} new messages"
                )

                # Avoid rate limiting
                if has_more:
                    time.sleep(1)

            except Exception as e:
                logger.error(
                    f"Error syncing messages for channel {channel.name}: {str(e)}"
                )
                error_count += 1
                # If we have too many errors, break
                if error_count >= 3:
                    break
                # Otherwise, continue with next batch
                time.sleep(2)

        # Update channel sync status
        channel.last_sync_at = datetime.utcnow()
        await db.commit()

        # Calculate sync stats
        elapsed_time = time.time() - start_time
        return {
            "status": "success",
            "channel_id": str(channel_id),
            "channel_name": channel.name,
            "processed_count": processed_count,
            "new_message_count": new_message_count,
            "updated_message_count": updated_message_count,
            "error_count": error_count,
            "elapsed_time": elapsed_time,
        }
