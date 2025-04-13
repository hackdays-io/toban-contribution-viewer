"""
Slack message retrieval and processing service.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException
from sqlalchemy import select, text
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
        thread_only: bool = False,
        thread_ts: Optional[str] = None,
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
            thread_only: Only retrieve thread parent messages
            thread_ts: Filter by specific thread timestamp

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
        query = select(SlackMessage).where(SlackMessage.channel_id == channel_id)

        # Apply thread filtering if specified
        if thread_only:
            query = query.where(SlackMessage.is_thread_parent.is_(True))

        if thread_ts:
            # If specific thread is requested, get parent and replies
            query = query.where(
                (SlackMessage.slack_ts == thread_ts)  # Get the parent
                | (
                    (SlackMessage.thread_ts == thread_ts)
                    & (SlackMessage.is_thread_reply.is_(True))
                )  # Get replies
            )

        # Sort by datetime descending (newest first)
        query = query.order_by(SlackMessage.message_datetime.desc())

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

        # Fetch and store thread replies if requested
        if include_replies and thread_ts_set:
            logger.info(f"Fetching replies for {len(thread_ts_set)} threads")
            total_replies_stored = 0

            for thread_ts in thread_ts_set:
                # Fetch thread replies from Slack API
                logger.info(
                    f"Fetching thread replies for thread {thread_ts} in channel {channel.name}"
                )
                thread_replies = (
                    await SlackMessageService._fetch_thread_replies_with_pagination(
                        access_token=channel.workspace.access_token,
                        channel_id=channel.slack_id,
                        thread_ts=thread_ts,
                        limit=100,  # Fetch up to 100 replies per page
                        max_pages=10,  # Maximum 10 pages (1000 replies)
                    )
                )

                # Get the parent message to associate replies with
                parent_result = await db.execute(
                    select(SlackMessage).where(
                        SlackMessage.channel_id == channel.id,
                        SlackMessage.slack_ts == thread_ts,
                    )
                )
                parent_message = parent_result.scalars().first()

                if not parent_message:
                    logger.warning(
                        f"Parent message for thread {thread_ts} not found, skipping replies"
                    )
                    continue

                # Track replies stored for this thread
                thread_reply_count = 0

                # Process and store each reply
                for reply in thread_replies:
                    # Skip if it's the parent message (which is included in replies)
                    if reply.get("ts") == thread_ts:
                        continue

                    # Check if this reply already exists in the database
                    existing_result = await db.execute(
                        select(SlackMessage).where(
                            SlackMessage.channel_id == channel.id,
                            SlackMessage.slack_ts == reply.get("ts"),
                        )
                    )
                    existing_reply = existing_result.scalars().first()

                    if existing_reply:
                        # Skip already stored replies
                        logger.debug(
                            f"Reply {reply.get('ts')} already exists, skipping"
                        )
                        continue

                    # Process and store the reply
                    reply_data = await SlackMessageService._prepare_message_data(
                        db=db,
                        workspace_id=workspace_id,
                        channel=channel,
                        message=reply,
                    )

                    # Create new message for the reply
                    db_reply = SlackMessage(**reply_data)
                    db.add(db_reply)
                    thread_reply_count += 1

                if thread_reply_count > 0:
                    # Update parent message with latest counts
                    parent_message.reply_count = (
                        len(thread_replies) - 1
                    )  # Subtract 1 for parent message
                    logger.info(
                        f"Stored {thread_reply_count} replies for thread {thread_ts}"
                    )
                    total_replies_stored += thread_reply_count

            # Commit all thread replies
            if total_replies_stored > 0:
                await db.commit()
                logger.info(f"Total thread replies stored: {total_replies_stored}")

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

        # Try to extract user ID from the text if not provided in the message
        extracted_user_id = None
        if not user_id and text and text.startswith("<@"):
            # Extract user ID from a message starting with <@USER_ID>
            import re

            match = re.match(r"^<@([A-Z0-9]+)>", text)
            if match:
                extracted_user_id = match.group(1)
                logger.info(f"Extracted user ID from message text: {extracted_user_id}")
                user_id = extracted_user_id

        # Convert Slack timestamp to datetime
        message_datetime = datetime.fromtimestamp(float(slack_ts))

        # Determine if message is part of a thread
        thread_ts = message.get("thread_ts")
        # A message is a thread parent if either:
        # 1. It has replies (reply_count > 0) AND
        # 2. Either thread_ts equals its own ts (it started a thread) OR thread_ts is None (not yet marked as thread)
        is_thread_parent = message.get("reply_count", 0) > 0 and (
            thread_ts == slack_ts or thread_ts is None
        )
        # A message is a thread reply if it has a thread_ts that's different from its own ts
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
            # Try to find user in database first
            user_result = await db.execute(
                select(SlackUser).where(
                    SlackUser.workspace_id == workspace_id,
                    SlackUser.slack_id == user_id,
                )
            )
            user = user_result.scalars().first()

            if user:
                # User exists in database, use their ID
                db_user_id = user.id
                logger.debug(
                    f"Found existing user in database: {user.name} ({user.slack_id})"
                )
            else:
                # User not found in database, fetch from Slack API and create
                try:
                    logger.info(
                        f"User {user_id} not found in database, fetching from Slack API"
                    )
                    new_user = await SlackMessageService._fetch_and_create_user(
                        db=db,
                        workspace_id=workspace_id,
                        slack_user_id=user_id,
                        access_token=channel.workspace.access_token,
                    )
                    if new_user:
                        db_user_id = new_user.id
                        logger.info(
                            f"Created new user: {new_user.name} ({new_user.slack_id})"
                        )
                except Exception as e:
                    logger.error(f"Error fetching user data from Slack API: {str(e)}")
                    # Continue without user ID, it will be None

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
    async def _fetch_thread_replies_with_pagination(
        access_token: str,
        channel_id: str,
        thread_ts: str,
        limit: int = 100,
        max_pages: int = 10,  # Limit to prevent excessive API calls
    ) -> List[Dict[str, Any]]:
        """
        Fetch thread replies with pagination support for deep threads.

        Args:
            access_token: Slack access token
            channel_id: Slack channel ID
            thread_ts: Thread parent timestamp
            limit: Maximum replies per page
            max_pages: Maximum number of pages to fetch

        Returns:
            List of all thread replies from Slack API
        """
        all_replies = []
        cursor = None
        page_count = 0

        client = SlackApiClient(access_token)

        # Log the thread fetch operation
        logger.info(
            f"Attempting to fetch thread replies for thread {thread_ts} in channel {channel_id}"
        )

        while page_count < max_pages:
            try:
                # Fetch replies for this page
                logger.info(
                    f"Making Slack API request for thread replies, page {page_count + 1}, cursor: {cursor or 'None'}"
                )
                response = await client.get_thread_replies(
                    channel_id=channel_id,
                    thread_ts=thread_ts,
                    cursor=cursor,
                    limit=limit,
                    inclusive=True,  # Include parent message
                )

                # Check for API errors
                has_error = "error" in response
                error_message = response.get("error", "None")

                if has_error:
                    logger.error(
                        f"Slack API error for thread {thread_ts}: {error_message}"
                    )
                    break

                # Add replies to our collection
                replies = response.get("messages", [])
                if replies:
                    all_replies.extend(replies)
                else:
                    logger.info(f"No replies found for thread {thread_ts}")

                # Check for more pages
                response_metadata = response.get("response_metadata", {})
                next_cursor = response_metadata.get("next_cursor")

                if not next_cursor:
                    break  # No more pages

                cursor = next_cursor
                page_count += 1

            except Exception as e:
                logger.error(f"Exception fetching thread replies: {str(e)}")
                break
        return all_replies

    @staticmethod
    async def _fetch_and_create_user(
        db: AsyncSession,
        workspace_id: str,
        slack_user_id: str,
        access_token: str,
    ) -> Optional[SlackUser]:
        """
        Fetch user info from Slack API and create a new SlackUser record in the database.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            slack_user_id: Slack user ID to fetch
            access_token: Slack access token for API requests

        Returns:
            Newly created SlackUser instance, or None if creation failed
        """
        try:
            # Create API client
            api_client = SlackApiClient(access_token)

            # Fetch user info from Slack API
            user_response = await api_client.get_user_info(slack_user_id)

            if not user_response.get("ok", False):
                logger.error(f"Error fetching user data: {user_response.get('error')}")
                return None

            user_data = user_response.get("user", {})
            if not user_data:
                logger.error("No user data returned from Slack API")
                return None

            # Extract user profile data
            profile = user_data.get("profile", {})

            # Prepare user data - truncate strings to avoid DB constraint errors
            def safe_str(s: Optional[str], max_len: int = 255) -> Optional[str]:
                if not s:
                    return None
                return s[:max_len] if len(s) > max_len else s

            # Create new user record
            new_user = SlackUser(
                workspace_id=workspace_id,
                slack_id=slack_user_id,
                name=safe_str(user_data.get("name")),
                display_name=safe_str(profile.get("display_name")),
                real_name=safe_str(profile.get("real_name")),
                email=safe_str(profile.get("email")),
                title=safe_str(profile.get("title")),
                phone=safe_str(profile.get("phone"), 50),
                timezone=safe_str(profile.get("tz"), 100),
                timezone_offset=user_data.get("tz_offset"),
                profile_image_url=safe_str(
                    profile.get("image_original") or profile.get("image_192"), 1024
                ),
                is_bot=user_data.get("is_bot", False),
                is_admin=user_data.get("is_admin", False),
                is_deleted=user_data.get("deleted", False),
                profile_data=profile,  # Store full profile data
            )

            # Add to database
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)

            return new_user

        except Exception as e:
            logger.error(f"Error creating user record: {str(e)}")
            await db.rollback()
            return None

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
    async def fix_message_user_references(
        db: AsyncSession,
        workspace_id: str,
        channel_id: Optional[str] = None,
    ) -> int:
        """
        Fix message user references by extracting user IDs from message text.

        This is a repair function that scans messages with null user_id but that
        contain references to users in the text (like "<@USER123>: message text")
        and links them to the appropriate SlackUser record.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_id: Optional UUID of a specific channel (if None, fix all channels)

        Returns:
            Number of message references fixed
        """
        try:
            logger.info(f"Fixing message user references for workspace {workspace_id}")

            # Build query conditions
            conditions = [
                "m.user_id IS NULL",
                "m.text ~ '^<@([A-Z0-9]+)>'",
                "u.workspace_id = :workspace_id",
            ]

            if channel_id:
                conditions.append("m.channel_id = :channel_id")

            # Construct the SQL query to fix message user references
            from sqlalchemy import text

            sql_text = f"""
            UPDATE slackmessage m
            SET user_id = u.id
            FROM slackuser u
            WHERE {' AND '.join(conditions)}
            AND u.slack_id = regexp_replace(m.text, '^<@([A-Z0-9]+)>.*', '\\1')
            """

            # Prepare parameters
            params = {"workspace_id": workspace_id}
            if channel_id:
                params["channel_id"] = channel_id

            # Execute the query using SQLAlchemy text() function
            result = await db.execute(text(sql_text), params)
            await db.commit()

            # Get the number of rows affected
            rows_affected = result.rowcount if hasattr(result, "rowcount") else 0
            logger.info(f"Fixed {rows_affected} message user references")

            return rows_affected

        except Exception as e:
            logger.error(f"Error fixing message user references: {str(e)}")
            await db.rollback()
            return 0

    @staticmethod
    async def sync_channel_messages(
        db: AsyncSession,
        workspace_id: str,
        channel_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_replies: bool = True,
        sync_threads: bool = True,
        thread_days: int = 30,
        batch_size: int = 200,
    ) -> Dict[str, Any]:
        """
        Sync messages and thread replies from a Slack channel to the database.

        This method fetches all normal messages and their thread replies in a single operation.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_id: UUID of the channel
            start_date: Optional start date for filtering messages
            end_date: Optional end date for filtering messages
            include_replies: Whether to include thread replies during message sync
            sync_threads: Whether to explicitly sync thread replies after message sync
            thread_days: Number of days of thread messages to sync
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

        # Try to fix any messages that might be missing user_id references
        try:
            fixed_count = await SlackMessageService.fix_message_user_references(
                db=db, workspace_id=workspace_id, channel_id=channel_id
            )
            logger.info(
                f"Fixed {fixed_count} message user references for channel {channel.name}"
            )
        except Exception as e:
            logger.error(f"Error fixing message user references: {str(e)}")
            fixed_count = 0

        # Sync thread replies if requested
        thread_sync_results = {
            "threads_synced": 0,
            "replies_synced": 0,
            "thread_errors": 0,
        }

        if sync_threads:
            try:
                logger.info(f"Starting thread sync for channel {channel.name}")

                # First, make sure thread parent flags are set correctly
                # Use direct SQL for efficiency
                thread_flag_sql = """
                UPDATE slackmessage 
                SET is_thread_parent = TRUE
                WHERE channel_id = :channel_id
                  AND reply_count > 0 
                  AND (thread_ts = slack_ts OR thread_ts IS NULL)
                  AND is_thread_parent = FALSE
                """

                result = await db.execute(
                    text(thread_flag_sql), {"channel_id": channel_id}
                )
                fixed_thread_flags = (
                    result.rowcount if hasattr(result, "rowcount") else 0
                )
                await db.commit()

                logger.info(f"Fixed {fixed_thread_flags} thread parent flags")

                # Get all thread parent messages in the timeframe
                end_date_for_threads = datetime.utcnow()
                start_date_for_threads = end_date_for_threads - timedelta(
                    days=thread_days
                )

                parent_result = await db.execute(
                    select(SlackMessage).where(
                        SlackMessage.channel_id == channel_id,
                        SlackMessage.is_thread_parent.is_(True),
                        SlackMessage.message_datetime >= start_date_for_threads,
                        SlackMessage.message_datetime <= end_date_for_threads,
                    )
                )
                parents = parent_result.scalars().all()

                thread_sync_results["threads_synced"] = len(parents)

                # Process each thread
                for parent in parents:
                    try:
                        # Fetch thread replies with pagination
                        thread_replies = await SlackMessageService._fetch_thread_replies_with_pagination(
                            access_token=workspace.access_token,
                            channel_id=channel.slack_id,
                            thread_ts=parent.slack_ts,
                        )

                        # Process each reply
                        for reply in thread_replies:
                            # Skip the parent message
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

                            if not existing:
                                # Process and store the reply
                                reply_data = (
                                    await SlackMessageService._prepare_message_data(
                                        db=db,
                                        workspace_id=workspace_id,
                                        channel=channel,
                                        message=reply,
                                    )
                                )

                                # Create new reply
                                db_reply = SlackMessage(**reply_data)
                                db.add(db_reply)
                                thread_sync_results["replies_synced"] += 1

                        # Update parent with latest counts
                        if thread_replies:
                            parent.reply_count = (
                                len(thread_replies) - 1
                            )  # Subtract 1 for parent message

                    except Exception as e:
                        logger.error(
                            f"Error syncing thread {parent.slack_ts}: {str(e)}"
                        )
                        thread_sync_results["thread_errors"] += 1

                # Commit all thread changes
                await db.commit()
                logger.info(f"Thread sync completed: {thread_sync_results}")

            except Exception as e:
                logger.error(f"Error during thread sync: {str(e)}")
                thread_sync_results["thread_errors"] += 1

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
            "fixed_references_count": fixed_count,
            "threads_synced": thread_sync_results["threads_synced"],
            "replies_synced": thread_sync_results["replies_synced"],
            "thread_errors": thread_sync_results["thread_errors"],
            "elapsed_time": elapsed_time,
        }
