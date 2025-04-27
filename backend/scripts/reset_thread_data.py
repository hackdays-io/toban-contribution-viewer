"""
Script to reset and recreate thread data.

This script:
1. Truncates existing thread replies
2. Resets thread parent flags
3. Rebuilds thread data by fetching from Slack API
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the parent directory to sys.path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

# Import after sys.path is updated - these imports must be here, ignore E402
# flake8: noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.session import async_engine, get_async_db
from app.models.slack import SlackChannel
from app.services.slack.messages import SlackMessageService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def reset_thread_data(channel_id=None):
    """
    Reset and recreate thread data by truncating existing thread replies
    and fetching them again from Slack API.

    Args:
        channel_id: Optional channel ID to limit the reset to one channel
    """
    logger.info("Starting thread data reset script")

    # Create database tables if they don't exist (in case of new setup)
    async with async_engine.begin() as conn:
        # This is a no-op if tables already exist
        await conn.run_sync(Base.metadata.create_all)

    # Get a database session - access the first value in the generator
    db_gen = get_async_db()
    db: AsyncSession = await db_gen.__anext__()

    try:
        # STEP 1: Truncate existing thread replies
        logger.info("Truncating existing thread replies")

        # Build the query to delete thread replies
        from sqlalchemy import text

        delete_query = """
        DELETE FROM slackmessage
        WHERE is_thread_reply = TRUE
        """

        # If channel_id is provided, limit to that channel
        if channel_id:
            delete_query += " AND channel_id = :channel_id"
            params = {"channel_id": channel_id}
        else:
            params = {}

        # Execute the query
        result = await db.execute(text(delete_query), params)
        deleted_count = result.rowcount
        await db.commit()

        logger.info(f"Deleted {deleted_count} thread replies")

        # STEP 2: Reset thread parent flags
        logger.info("Resetting thread parent flags")

        reset_query = """
        UPDATE slackmessage
        SET is_thread_parent = FALSE
        WHERE is_thread_parent = TRUE
        """

        # If channel_id is provided, limit to that channel
        if channel_id:
            reset_query += " AND channel_id = :channel_id"

        # Execute the query
        result = await db.execute(text(reset_query), params)
        reset_count = result.rowcount
        await db.commit()

        logger.info(f"Reset {reset_count} thread parent flags")

        # STEP 3: Set correct thread parent flags
        logger.info("Setting correct thread parent flags")

        update_query = """
        UPDATE slackmessage
        SET is_thread_parent = TRUE
        WHERE reply_count > 0
          AND (thread_ts = slack_ts OR thread_ts IS NULL)
        """

        # If channel_id is provided, limit to that channel
        if channel_id:
            update_query += " AND channel_id = :channel_id"

        # Execute the query
        result = await db.execute(text(update_query), params)
        updated_count = result.rowcount
        await db.commit()

        logger.info(f"Updated {updated_count} thread parent flags")

        # STEP 4: Find all thread parent messages and fetch their replies
        logger.info("Finding thread parent messages")

        # Import needed modules for this operation
        from sqlalchemy import select

        from app.models.slack import SlackMessage

        # Build the query to find thread parent messages
        query = select(SlackMessage).where(SlackMessage.is_thread_parent.is_(True), SlackMessage.reply_count > 0)

        # If channel_id is provided, limit to that channel
        if channel_id:
            query = query.where(SlackMessage.channel_id == channel_id)

        # Execute the query
        result = await db.execute(query)
        parent_messages = result.scalars().all()

        logger.info(f"Found {len(parent_messages)} thread parent messages")

        # Process each thread parent message
        threads_processed = 0
        total_replies_added = 0

        from sqlalchemy.orm import selectinload

        for parent in parent_messages:
            threads_processed += 1
            logger.info(f"Processing thread {threads_processed}/{len(parent_messages)}: {parent.slack_ts}")

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
                logger.warning(f"No access token for workspace {channel.workspace.id}, skipping")
                continue

            # Fetch thread replies from Slack API
            try:
                thread_replies = await SlackMessageService._fetch_thread_replies_with_pagination(
                    access_token=channel.workspace.access_token,
                    channel_id=channel.slack_id,
                    thread_ts=parent.slack_ts,
                    limit=500,  # Fetch up to 500 replies per page
                    max_pages=20,  # Maximum 20 pages (10,000 replies should be enough)
                )

                logger.info(f"Fetched {len(thread_replies)} replies for thread {parent.slack_ts}")

                # Process and store each reply
                replies_added = 0
                for reply in thread_replies:
                    # Skip if it's the parent message (which is included in replies)
                    if reply.get("ts") == parent.slack_ts:
                        continue

                    # Process reply
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

                # Update parent message with reply count
                parent.reply_count = len(thread_replies) - 1  # Subtract 1 for parent message

                # Commit changes for this thread
                if replies_added > 0:
                    await db.commit()
                    total_replies_added += replies_added
                    logger.info(f"Added {replies_added} replies for thread {parent.slack_ts}")

            except Exception as e:
                logger.error(f"Error processing thread {parent.slack_ts}: {e}")
                await db.rollback()

        logger.info(
            f"Thread data reset complete. Processed {threads_processed} threads and added {total_replies_added} replies."
        )
        return {
            "deleted_replies": deleted_count,
            "reset_flags": reset_count,
            "updated_flags": updated_count,
            "threads_processed": threads_processed,
            "replies_added": total_replies_added,
        }

    except Exception as e:
        logger.error(f"Error resetting thread data: {str(e)}")
        await db.rollback()
        raise
    finally:
        await db.close()


async def main():
    """Main entry point for the script."""
    try:
        # Parse command line arguments for channel_id
        import argparse

        parser = argparse.ArgumentParser(description="Reset thread data in the database")
        parser.add_argument("--channel", help="Channel ID to process (optional)")
        args = parser.parse_args()

        result = await reset_thread_data(channel_id=args.channel)
        logger.info(f"Script completed successfully. Results: {result}")
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
