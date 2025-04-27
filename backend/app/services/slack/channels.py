"""
Service for managing Slack channels.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.slack import SlackChannel, SlackWorkspace
from app.services.slack.api import SlackApiClient, SlackApiError

# Configure logging
logger = logging.getLogger(__name__)


async def get_channel_by_id(db: AsyncSession, workspace_id: str, channel_id: str) -> Optional[SlackChannel]:
    """
    Get a channel by its ID.

    Args:
        db: Database session
        workspace_id: UUID of the workspace
        channel_id: UUID of the channel

    Returns:
        SlackChannel or None if not found
    """
    result = await db.execute(
        select(SlackChannel).where(SlackChannel.workspace_id == workspace_id, SlackChannel.id == channel_id)
    )
    return result.scalars().first()


class ChannelService:
    """
    Service for retrieving and managing Slack channels.
    """

    @staticmethod
    async def get_channels_for_workspace(
        db: AsyncSession,
        workspace_id: str,
        channel_types: Optional[List[str]] = None,
        include_archived: bool = False,
        page: int = 1,
        page_size: int = 100,
        bot_installed_only: bool = False,
        selected_for_analysis_only: bool = False,
    ) -> Dict[str, Any]:
        """
        Get channels for a specific workspace with pagination.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_types: Optional list of channel types to filter by
                          (public, private, mpim, im)
            include_archived: Whether to include archived channels
            page: Page number for pagination (1-indexed)
            page_size: Number of items per page
            bot_installed_only: Only include channels where the bot is installed
            selected_for_analysis_only: Only include channels that are selected for analysis

        Returns:
            Dictionary containing the channels and pagination metadata
        """
        # Check if workspace exists and get access token
        result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
        workspace = result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        if not workspace.access_token:
            logger.error(f"Workspace has no access token: {workspace_id}")
            raise HTTPException(status_code=400, detail="Workspace is not properly connected")

        # Fetch channels from database first
        query = select(SlackChannel).where(SlackChannel.workspace_id == workspace_id)

        logger.info(
            f"Building query for workspace_id={workspace_id}, channel_types={channel_types}, include_archived={include_archived}"
        )

        # Check and log the actual values in the database for debugging
        existing_types_query = select(SlackChannel.type).where(SlackChannel.workspace_id == workspace_id).distinct()
        existing_types_result = await db.execute(existing_types_query)
        existing_types = [row[0] for row in existing_types_result.fetchall()]
        logger.info(f"Existing channel types in database: {existing_types}")

        # Apply filters
        if channel_types:
            if set(channel_types) == set(["public", "private", "im", "mpim"]):
                # When all types are requested, don't apply the filter
                logger.info("All channel types requested, not applying type filter")
            else:
                # Apply filter for specific types
                query = query.where(SlackChannel.type.in_(channel_types))
                logger.info(f"Applied channel type filter: {channel_types}")

        if not include_archived:
            query = query.where(SlackChannel.is_archived.is_(False))
            logger.info("Excluded archived channels")

        # Apply bot installation filter if requested
        if bot_installed_only:
            query = query.where(SlackChannel.has_bot.is_(True))
            logger.info("Filtered to only include channels where bot is installed")

        # Apply analysis selection filter if requested
        if selected_for_analysis_only:
            query = query.where(SlackChannel.is_selected_for_analysis.is_(True))
            logger.info("Filtered to only include channels selected for analysis")

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order_by(SlackChannel.name).offset(offset).limit(page_size)
        logger.info(f"Applied pagination: offset={offset}, limit={page_size}")

        # Execute query
        try:
            result = await db.execute(query)
            channels = result.scalars().all()
            logger.info(f"Found {len(channels)} channels in database")
        except Exception as e:
            logger.error(f"Database error when fetching channels: {str(e)}")
            raise

        # Get total count for pagination
        count_query = select(SlackChannel).where(SlackChannel.workspace_id == workspace_id)
        if channel_types:
            if set(channel_types) == set(["public", "private", "im", "mpim"]):
                # When all types are requested, don't apply the filter to count query
                logger.info("All channel types requested, not applying type filter to count query")
            else:
                # Apply filter for specific types
                count_query = count_query.where(SlackChannel.type.in_(channel_types))
                logger.info(f"Applied channel type filter to count query: {channel_types}")
        if not include_archived:
            count_query = count_query.where(SlackChannel.is_archived.is_(False))
            logger.info("Excluded archived channels from count query")

        # Apply bot installation filter if requested
        if bot_installed_only:
            count_query = count_query.where(SlackChannel.has_bot.is_(True))
            logger.info("Filtered count query to only include channels where bot is installed")

        # Apply analysis selection filter if requested
        if selected_for_analysis_only:
            count_query = count_query.where(SlackChannel.is_selected_for_analysis.is_(True))
            logger.info("Filtered count query to only include channels selected for analysis")

        try:
            count_result = await db.execute(count_query)
            count_channels = count_result.scalars().all()
            total_count = len(count_channels)
            logger.info(f"Total channel count: {total_count}")
        except Exception as e:
            logger.error(f"Database error when counting channels: {str(e)}")
            total_count = len(channels)  # Fallback to the number of channels we retrieved
            logger.warning(f"Using fallback count: {total_count}")

        # Format response
        channel_list = [
            {
                "id": str(channel.id),
                "slack_id": channel.slack_id,
                "name": channel.name,
                "type": channel.type,
                "purpose": channel.purpose,
                "topic": channel.topic,
                "member_count": channel.member_count,
                "is_archived": channel.is_archived,
                "has_bot": channel.has_bot,
                "is_selected_for_analysis": channel.is_selected_for_analysis,
                "is_supported": channel.is_supported,
                "last_sync_at": channel.last_sync_at,
            }
            for channel in channels
        ]

        return {
            "channels": channel_list,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
            },
        }

    @staticmethod
    async def sync_channels_from_slack(
        db: AsyncSession,
        workspace_id: str,
        limit: int = 1000,
        sync_all_pages: bool = True,
    ) -> Tuple[int, int, int]:
        """
        Sync channels from Slack API to database.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            limit: Maximum number of channels to fetch per request
            sync_all_pages: Whether to sync all pages of channels

        Returns:
            Tuple of (created_count, updated_count, total_count)
        """
        # Get workspace
        result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
        workspace = result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        if not workspace.access_token:
            logger.error(f"Workspace has no access token: {workspace_id}")
            raise HTTPException(status_code=400, detail="Workspace is not properly connected")

        # Create API client
        api_client = SlackApiClient(workspace.access_token)

        # Keep track of stats
        created_count = 0
        updated_count = 0
        total_count = 0

        # Track all channel ids to detect channels that have been deleted
        synced_channel_ids = set()

        # Sync channels
        cursor = None
        has_more = True
        page_count = 0
        max_pages = 5  # Reduced to 5 pages to avoid timeouts

        logger.info(f"Starting channel sync for workspace {workspace_id} with limit={limit}")

        while has_more and page_count < max_pages:
            page_count += 1
            try:
                logger.info(f"Fetching channel page {page_count} for workspace {workspace_id}")

                # Set the types to fetch - make explicit for clarity
                channel_types = "public_channel,private_channel,mpim,im"

                # Fetch channels from Slack API
                logger.info(f"API request with cursor={cursor}, limit={limit}, types={channel_types}")
                response = await api_client.get_channels(
                    cursor=cursor,
                    limit=limit,
                    types=channel_types,
                    exclude_archived=False,  # We'll fetch all and mark archived in our DB
                )

                channels = response.get("channels", [])
                total_count += len(channels)

                # Process channels
                for channel_data in channels:
                    channel_id = channel_data.get("id")
                    if not channel_id:
                        continue

                    # Add to synced channels
                    synced_channel_ids.add(channel_id)

                    # Map the type field
                    channel_type = "unknown"
                    if channel_data.get("is_channel") or channel_data.get("is_general"):
                        channel_type = "public"
                    elif channel_data.get("is_group") or channel_data.get("is_private"):
                        channel_type = "private"
                    elif channel_data.get("is_mpim"):
                        channel_type = "mpim"
                    elif channel_data.get("is_im"):
                        channel_type = "im"

                    # Log the mapping for debugging
                    logger.info(
                        f"Channel {channel_data.get('name', 'unknown')}: "
                        + f"is_channel={channel_data.get('is_channel')}, "
                        + f"is_private={channel_data.get('is_private')}, "
                        + f"is_group={channel_data.get('is_group')}, "
                        + f"is_mpim={channel_data.get('is_mpim')}, "
                        + f"is_im={channel_data.get('is_im')} "
                        + f"→ mapped to: {channel_type}"
                    )

                    # Check if channel already exists
                    channel_result = await db.execute(
                        select(SlackChannel).where(
                            SlackChannel.workspace_id == workspace_id,
                            SlackChannel.slack_id == channel_id,
                        )
                    )
                    existing_channel = channel_result.scalars().first()

                    # Check if the bot is a member of this channel
                    has_bot = channel_data.get("is_member", False)
                    if not has_bot and channel_type in ["public", "private"]:
                        try:
                            has_bot = await api_client.check_bot_in_channel(channel_id)
                        except Exception as e:
                            logger.warning(f"Error checking bot membership in {channel_id}: {str(e)}")

                    # Prepare channel data
                    created_ts = channel_data.get("created")
                    # Convert to string if int/float
                    if created_ts is not None and not isinstance(created_ts, str):
                        created_ts = str(created_ts)

                    channel_values = {
                        "slack_id": channel_id,
                        "name": channel_data.get("name", f"unknown-{channel_id}"),
                        "type": channel_type,
                        "purpose": channel_data.get("purpose", {}).get("value", ""),
                        "topic": channel_data.get("topic", {}).get("value", ""),
                        "member_count": channel_data.get("num_members", 0),
                        "is_archived": channel_data.get("is_archived", False),
                        "created_at_ts": created_ts,
                        "has_bot": has_bot,
                        "is_supported": True,  # By default, all channels are supported
                    }

                    # For new channels, set bot_joined_at if bot is a member
                    if has_bot and not existing_channel:
                        channel_values["bot_joined_at"] = datetime.utcnow()

                    if existing_channel:
                        # Update existing channel
                        for key, value in channel_values.items():
                            setattr(existing_channel, key, value)

                        # Only update bot_joined_at if the bot was not a member before but is now
                        if has_bot and not existing_channel.has_bot:
                            existing_channel.bot_joined_at = datetime.utcnow()

                        updated_count += 1
                    else:
                        # Create new channel
                        new_channel = SlackChannel(workspace_id=workspace_id, **channel_values)
                        db.add(new_channel)
                        created_count += 1

                # Update cursor for pagination
                cursor = response.get("response_metadata", {}).get("next_cursor")
                # Log the cursor for debugging
                logger.info(f"Next cursor: {cursor}")
                # Only continue if cursor is not empty and sync_all_pages is True
                has_more = bool(cursor and cursor.strip() and sync_all_pages)

                # Log progress
                logger.info(
                    f"Processed {len(channels)} channels on page {page_count}. Running totals: created={created_count}, updated={updated_count}, total={total_count}"
                )

                # Commit changes after each page
                await db.commit()

            except SlackApiError as e:
                logger.error(f"Error syncing channels: {str(e)}")
                # Rollback any changes
                await db.rollback()
                error_detail = f"Error syncing channels from Slack: {str(e)}"
                if hasattr(e, "error_code") and e.error_code == "missing_scope":
                    error_detail = "Missing required Slack permissions (scopes). The Slack app needs additional permissions like channels:read, groups:read, im:read, and mpim:read to list channels."
                logger.error(error_detail)
                raise HTTPException(status_code=500, detail=error_detail)

        # Log if we hit the maximum number of pages
        if has_more and page_count >= max_pages:
            logger.warning(
                f"Reached maximum page count ({max_pages}) for workspace {workspace_id}. Some channels may not have been synced."
            )

        logger.info(f"Completed channel sync: processed {page_count} pages with {total_count} total channels")

        # Update channels that were not found in the API to mark them as archived
        # This handles channels that might have been deleted or the bot removed from
        if synced_channel_ids:
            try:
                # Find channels that weren't in the synced set
                missing_channels_result = await db.execute(
                    select(SlackChannel).where(
                        SlackChannel.workspace_id == workspace_id,
                        SlackChannel.slack_id.not_in(list(synced_channel_ids)),
                    )
                )
                missing_channels = missing_channels_result.scalars().all()

                # Mark them as archived
                for channel in missing_channels:
                    channel.is_archived = True
                    channel.has_bot = False
                    updated_count += 1

                await db.commit()

            except Exception as e:
                logger.error(f"Error updating missing channels: {str(e)}")
                await db.rollback()

        return (created_count, updated_count, total_count)

    @staticmethod
    async def select_channels_for_analysis(
        db: AsyncSession,
        workspace_id: str,
        channel_ids: List[str],
        install_bot: bool = True,
        for_analysis: bool = True,
    ) -> Dict[str, Any]:
        """
        Select channels for analysis and optionally install the bot in channels where it's not already a member.

        Args:
            db: Database session
            workspace_id: UUID of the workspace
            channel_ids: List of channel UUIDs to select for analysis
            install_bot: Whether to attempt to install the bot in selected channels where it's not already a member
            for_analysis: Whether to mark channels for analysis (True) or remove them from analysis (False)

        Returns:
            Dictionary with status information
        """
        try:
            # Verify workspace exists and get access token
            workspace_result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == workspace_id))
            workspace = workspace_result.scalars().first()

            if not workspace:
                logger.error(f"Workspace not found: {workspace_id}")
                raise HTTPException(status_code=404, detail="Workspace not found")

            if install_bot and not workspace.access_token:
                logger.error(f"Workspace has no access token: {workspace_id}")
                raise HTTPException(status_code=400, detail="Workspace is not properly connected")

            # Create API client if we need to install the bot
            api_client = None
            if install_bot:
                api_client = SlackApiClient(workspace.access_token)

            # Unselect all channels if we are setting for_analysis=True
            # This is for backward compatibility with old behavior
            if for_analysis:
                # First, unselect all channels
                await db.execute(
                    update(SlackChannel)
                    .where(SlackChannel.workspace_id == workspace_id)
                    .values(is_selected_for_analysis=False)
                )

            # Then update the specified channels based on for_analysis flag
            if channel_ids:
                # Log the channels we're trying to update
                logger.info(f"Attempting to update channels with IDs: {channel_ids}")
                logger.info(f"for_analysis={for_analysis}, workspace_id={workspace_id}")

                # Convert string IDs to UUIDs if needed
                uuid_channel_ids = []
                for channel_id in channel_ids:
                    try:
                        # Try to convert to UUID if it's not already
                        uuid_channel_id = uuid.UUID(channel_id)
                        uuid_channel_ids.append(uuid_channel_id)
                    except ValueError:
                        logger.error(f"Invalid channel ID format: {channel_id}")

                if not uuid_channel_ids:
                    logger.warning("No valid channel IDs to update")
                    return {
                        "status": "warning",
                        "message": "No valid channel IDs provided",
                        "selected_count": 0,
                        "selected_channels": [],
                    }

                # Execute the update with the UUID list
                await db.execute(
                    update(SlackChannel)
                    .where(
                        SlackChannel.workspace_id == workspace_id,
                        SlackChannel.id.in_(uuid_channel_ids),
                    )
                    .values(is_selected_for_analysis=for_analysis)
                )

            # First, let's log all channels for this workspace to debug
            all_channels_result = await db.execute(
                select(SlackChannel).where(SlackChannel.workspace_id == workspace_id)
            )
            all_channels = all_channels_result.scalars().all()
            logger.info(f"Found {len(all_channels)} total channels for workspace_id={workspace_id}")

            # For debugging, check if the specific channel exists
            for channel in all_channels:
                logger.info(f"Channel in DB: id={channel.id}, name={channel.name}, slack_id={channel.slack_id}")

                # Check if any of the requested channel_ids match this channel
                for channel_id in channel_ids:
                    try:
                        check_uuid = uuid.UUID(channel_id)
                        if check_uuid == channel.id:
                            logger.info(
                                f"Found match for requested channel_id={channel_id} → DB channel={channel.id}, name={channel.name}"
                            )
                    except ValueError:
                        pass

            # Get selected channels after our update
            selected_count_result = await db.execute(
                select(SlackChannel).where(
                    SlackChannel.workspace_id == workspace_id,
                    SlackChannel.is_selected_for_analysis.is_(True),
                )
            )
            selected_channels = selected_count_result.scalars().all()
            logger.info(f"Found {len(selected_channels)} channels marked for analysis after update")

            # Install bot in selected channels if requested
            bot_installation_results = []
            if install_bot and api_client and selected_channels:
                for channel in selected_channels:
                    # Skip channels where bot is already a member or types that don't need installation (like DMs)
                    if channel.has_bot or channel.type not in [
                        "public",
                        "private",
                    ]:
                        continue

                    try:
                        # Try to join the channel
                        logger.info(f"Attempting to join channel {channel.name} ({channel.slack_id})")
                        await api_client.join_channel(channel.slack_id)

                        # Update channel record
                        channel.has_bot = True
                        channel.bot_joined_at = datetime.utcnow()

                        bot_installation_results.append(
                            {
                                "channel_id": str(channel.id),
                                "name": channel.name,
                                "status": "success",
                            }
                        )
                        logger.info(f"Successfully joined channel {channel.name}")

                    except SlackApiError as e:
                        error_message = str(e)
                        if hasattr(e, "error_code"):
                            error_code = e.error_code
                        else:
                            error_code = "unknown_error"

                        bot_installation_results.append(
                            {
                                "channel_id": str(channel.id),
                                "name": channel.name,
                                "status": "error",
                                "error_code": error_code,
                                "error_message": error_message,
                            }
                        )
                        logger.error(f"Failed to join channel {channel.name}: {error_message}")

            # Commit the changes
            await db.commit()

            # Prepare response
            response = {
                "status": "success",
                "message": f"Selected {len(selected_channels)} channels for analysis",
                "selected_count": len(selected_channels),
                "selected_channels": [
                    {
                        "id": str(channel.id),
                        "name": channel.name,
                        "type": channel.type,
                        "has_bot": channel.has_bot,
                    }
                    for channel in selected_channels
                ],
            }

            # Add bot installation results if applicable
            if install_bot and bot_installation_results:
                response["bot_installation"] = {
                    "attempted_count": len(bot_installation_results),
                    "results": bot_installation_results,
                }

            return response

        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            logger.error(f"Error selecting channels for analysis: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail="An error occurred while selecting channels for analysis",
            )

    @staticmethod
    async def sync_channels_from_slack_background(
        workspace_id: str,
        access_token: str,
        limit: int = 1000,
        sync_all_pages: bool = True,
        batch_size: int = 200,
    ) -> None:
        """
        Background task to sync channels from Slack API to database.
        This method is designed to run as a background task and handles its own database session.

        Args:
            workspace_id: UUID of the workspace
            access_token: Slack access token
            limit: Maximum number of channels to fetch per request
            sync_all_pages: Whether to sync all pages of channels
            batch_size: Number of channels to process in each batch for memory efficiency
        """
        logger.info(f"Starting background channel sync for workspace {workspace_id}")
        start_time = time.time()

        # Create API client
        api_client = SlackApiClient(access_token)

        try:
            # Create a new database session for this background task
            session = AsyncSessionLocal()

            # Stats tracking
            created_count = 0
            updated_count = 0
            total_count = 0
            synced_channel_ids: Set[str] = set()

            # Update workspace status to indicate sync in progress
            try:
                await session.execute(
                    update(SlackWorkspace).where(SlackWorkspace.id == workspace_id).values(connection_status="syncing")
                )
                await session.commit()
            except Exception as e:
                logger.error(f"Error updating workspace status: {str(e)}")
                await session.rollback()

            # Sync channels in batches with pagination
            cursor = None
            has_more = True
            page_count = 0
            max_pages = 20  # Increased from 5 to handle larger workspaces

            channels_to_process = []

            while has_more and page_count < max_pages:
                page_count += 1
                try:
                    logger.info(f"Background sync: Fetching channel page {page_count} for workspace {workspace_id}")

                    # Set the types to fetch - make explicit for clarity
                    channel_types = "public_channel,private_channel,mpim,im"

                    # Fetch channels from Slack API
                    logger.info(
                        f"Background sync: API request with cursor={cursor}, limit={limit}, types={channel_types}"
                    )
                    response = await api_client.get_channels(
                        cursor=cursor,
                        limit=limit,
                        types=channel_types,
                        exclude_archived=False,  # We'll fetch all and mark archived in our DB
                    )

                    channels = response.get("channels", [])
                    total_in_page = len(channels)
                    total_count += total_in_page

                    logger.info(f"Background sync: Retrieved {total_in_page} channels in page {page_count}")

                    # Add channels to batch for processing
                    channels_to_process.extend(channels)

                    # Process channels in batches to avoid memory issues
                    if len(channels_to_process) >= batch_size or not (cursor and cursor.strip() and sync_all_pages):
                        logger.info(f"Background sync: Processing batch of {len(channels_to_process)} channels")

                        batch_created, batch_updated = await ChannelService._process_channel_batch(
                            session=session,
                            workspace_id=workspace_id,
                            api_client=api_client,
                            channels=channels_to_process,
                            synced_ids=synced_channel_ids,
                        )

                        created_count += batch_created
                        updated_count += batch_updated

                        # Clear the batch
                        channels_to_process = []

                        # Commit after each batch
                        await session.commit()

                        logger.info(
                            f"Background sync: Batch processed and committed. "
                            f"Running totals: created={created_count}, updated={updated_count}, total={total_count}"
                        )

                    # Update cursor for pagination
                    cursor = response.get("response_metadata", {}).get("next_cursor")

                    # Only continue if cursor is not empty and sync_all_pages is True
                    has_more = bool(cursor and cursor.strip() and sync_all_pages)

                    # Add a small delay between API calls to avoid rate limiting
                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.error(f"Background sync: Error processing page {page_count}: {str(e)}")
                    # Continue with next page rather than aborting the entire process
                    await asyncio.sleep(1)  # Delay before next attempt

            # Process any remaining channels
            if channels_to_process:
                logger.info(f"Background sync: Processing final batch of {len(channels_to_process)} channels")
                batch_created, batch_updated = await ChannelService._process_channel_batch(
                    session=session,
                    workspace_id=workspace_id,
                    api_client=api_client,
                    channels=channels_to_process,
                    synced_ids=synced_channel_ids,
                )

                created_count += batch_created
                updated_count += batch_updated

                # Commit the final batch
                await session.commit()

            # Update channels that were not found to mark them as archived
            if synced_channel_ids:
                try:
                    logger.info(
                        f"Background sync: Checking for channels no longer in Slack (count: {len(synced_channel_ids)})"
                    )
                    # Find channels that weren't in the synced set
                    missing_channels_result = await session.execute(
                        select(SlackChannel).where(
                            SlackChannel.workspace_id == workspace_id,
                            SlackChannel.slack_id.not_in(list(synced_channel_ids)),
                        )
                    )
                    missing_channels = missing_channels_result.scalars().all()

                    # Mark them as archived
                    missing_count = 0
                    for channel in missing_channels:
                        channel.is_archived = True
                        channel.has_bot = False
                        missing_count += 1

                    if missing_count > 0:
                        logger.info(f"Background sync: Marked {missing_count} channels as archived")
                        updated_count += missing_count
                        await session.commit()

                except Exception as e:
                    logger.error(f"Background sync: Error updating missing channels: {str(e)}")
                    await session.rollback()

            # Update workspace with sync timestamp and status
            try:
                sync_complete_time = datetime.utcnow()
                await session.execute(
                    update(SlackWorkspace)
                    .where(SlackWorkspace.id == workspace_id)
                    .values(last_sync_at=sync_complete_time, connection_status="active")
                )
                await session.commit()

                # Log completion with timestamp to help with debugging
                logger.info(
                    f"Background sync: Updated workspace status to 'active' with last_sync_at={sync_complete_time.isoformat()}"
                )
            except Exception as e:
                logger.error(f"Background sync: Error updating workspace sync timestamp: {str(e)}")
                await session.rollback()

            elapsed_time = time.time() - start_time
            logger.info(
                f"Background sync: Completed channel sync for workspace {workspace_id}: "
                f"created={created_count}, updated={updated_count}, total={total_count}, "
                f"time={elapsed_time:.2f}s"
            )

        except Exception as e:
            logger.error(f"Background sync: Unhandled error in channel sync: {str(e)}")
            # Try to update workspace status to indicate error
            try:
                if "session" in locals() and session:
                    await session.execute(
                        update(SlackWorkspace)
                        .where(SlackWorkspace.id == workspace_id)
                        .values(connection_status="error")
                    )
                    await session.commit()
            except Exception as nested_error:
                logger.error(f"Background sync: Error updating workspace status after error: {str(nested_error)}")
        finally:
            # Ensure the session is closed
            if "session" in locals() and session:
                await session.close()

    @staticmethod
    async def _process_channel_batch(
        session: AsyncSession,
        workspace_id: str,
        api_client: SlackApiClient,
        channels: List[Dict[str, Any]],
        synced_ids: Set[str],
    ) -> Tuple[int, int]:
        """
        Process a batch of channels from the Slack API.

        Args:
            session: Database session
            workspace_id: Workspace ID
            api_client: SlackApiClient instance
            channels: List of channel data from Slack API
            synced_ids: Set to track synced channel IDs

        Returns:
            Tuple of (created_count, updated_count)
        """
        created_count = 0
        updated_count = 0

        # Process each channel in the batch
        for channel_data in channels:
            channel_id = channel_data.get("id")
            if not channel_id:
                continue

            # Add to synced channels
            synced_ids.add(channel_id)

            # Map the type field
            channel_type = "unknown"
            if channel_data.get("is_channel") or channel_data.get("is_general"):
                channel_type = "public"
            elif channel_data.get("is_group") or channel_data.get("is_private"):
                channel_type = "private"
            elif channel_data.get("is_mpim"):
                channel_type = "mpim"
            elif channel_data.get("is_im"):
                channel_type = "im"

            # Log the mapping for debugging
            logger.info(
                f"Batch process - Channel {channel_data.get('name', 'unknown')}: "
                + f"is_channel={channel_data.get('is_channel')}, "
                + f"is_private={channel_data.get('is_private')}, "
                + f"is_group={channel_data.get('is_group')}, "
                + f"is_mpim={channel_data.get('is_mpim')}, "
                + f"is_im={channel_data.get('is_im')} "
                + f"→ mapped to: {channel_type}"
            )

            # Check if channel already exists
            channel_result = await session.execute(
                select(SlackChannel).where(
                    SlackChannel.workspace_id == workspace_id,
                    SlackChannel.slack_id == channel_id,
                )
            )
            existing_channel = channel_result.scalars().first()

            # Check if the bot is a member of this channel
            has_bot = channel_data.get("is_member", False)

            # Only check bot membership for non-DM channels when needed
            if not has_bot and channel_type in ["public", "private"]:
                try:
                    has_bot = await api_client.check_bot_in_channel(channel_id)
                except Exception as e:
                    logger.warning(f"Error checking bot membership in {channel_id}: {str(e)}")

            # Prepare channel data
            created_ts = channel_data.get("created")
            # Convert to string if int/float
            if created_ts is not None and not isinstance(created_ts, str):
                created_ts = str(created_ts)

            channel_values = {
                "slack_id": channel_id,
                "name": channel_data.get("name", f"unknown-{channel_id}"),
                "type": channel_type,
                "purpose": channel_data.get("purpose", {}).get("value", ""),
                "topic": channel_data.get("topic", {}).get("value", ""),
                "member_count": channel_data.get("num_members", 0),
                "is_archived": channel_data.get("is_archived", False),
                "created_at_ts": created_ts,
                "has_bot": has_bot,
                "is_supported": True,  # By default, all channels are supported
                "last_sync_at": datetime.utcnow(),
            }

            # For new channels, set bot_joined_at if bot is a member
            if has_bot and not existing_channel:
                channel_values["bot_joined_at"] = datetime.utcnow()

            if existing_channel:
                # Update existing channel
                for key, value in channel_values.items():
                    setattr(existing_channel, key, value)

                # Only update bot_joined_at if the bot was not a member before but is now
                if has_bot and not existing_channel.has_bot:
                    existing_channel.bot_joined_at = datetime.utcnow()

                updated_count += 1
            else:
                # Create new channel
                new_channel = SlackChannel(workspace_id=workspace_id, **channel_values)
                session.add(new_channel)
                created_count += 1

        return created_count, updated_count
