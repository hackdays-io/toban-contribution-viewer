"""
Script to fix thread data by directly loading thread replies from Slack API.

This script:
1. Finds all thread parent messages in the database
2. Directly calls Slack API to fetch full thread replies for each
3. Updates the database with all replies
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the parent directory to sys.path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

# Import after sys.path is updated - these imports must be here, ignore E402
# flake8: noqa: E402
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.session import async_engine, get_async_db
from app.models.slack import SlackChannel, SlackMessage
from app.services.slack.messages import SlackMessageService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def fix_thread_data(channel_id=None, max_threads=50):
    """
    Fix thread data by loading thread replies directly from Slack API.

    Args:
        channel_id: Optional channel ID to limit the fix to one channel
        max_threads: Maximum number of threads to process (to avoid timeouts)
    """
    logger.info("Starting thread data fix script")

    # Create database tables if they don't exist (in case of new setup)
    async with async_engine.begin() as conn:
        # This is a no-op if tables already exist
        await conn.run_sync(Base.metadata.create_all)

    # Get a database session - access the first value in the generator
    db_gen = get_async_db()
    db: AsyncSession = await db_gen.__anext__()

    try:
        # Build the query to find thread parent messages
        query = select(SlackMessage).where(SlackMessage.is_thread_parent.is_(True), SlackMessage.reply_count > 0)

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
            logger.info(f"Processing thread {threads_processed}/{len(parent_messages)}: {parent.slack_ts}")

            # Get the channel info for this message
            channel_result = await db.execute(
                select(SlackChannel).options(select(SlackChannel.workspace)).where(SlackChannel.id == parent.channel_id)
            )
            channel = channel_result.scalars().first()

            if not channel:
                logger.warning(f"Channel not found for message {parent.id}, skipping")
                continue

            if not channel.workspace.access_token:
                logger.warning(f"No access token for workspace {channel.workspace.id}, skipping")
                continue

            # API client will be created in the service

            # Fetch full thread from Slack API
            try:
                thread_replies = await SlackMessageService._fetch_thread_replies_with_pagination(
                    access_token=channel.workspace.access_token,
                    channel_id=channel.slack_id,
                    thread_ts=parent.slack_ts,
                    limit=500,  # Fetch up to 500 replies per page
                    max_pages=20,  # Maximum 20 pages (10,000 replies should be enough)
                )

                logger.info(f"Fetched {len(thread_replies)} replies for thread {parent.slack_ts}")

                # If we got no replies, skip
                if not thread_replies:
                    logger.warning(f"No replies found for thread {parent.slack_ts}")
                    continue

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
                parent.reply_count = len(thread_replies) - 1  # Subtract 1 for parent message

                # Commit changes for this thread
                if replies_added > 0:
                    await db.commit()
                    total_replies_added += replies_added
                    logger.info(f"Added/updated {replies_added} replies for thread {parent.slack_ts}")

            except Exception as e:
                logger.error(f"Error processing thread {parent.slack_ts}: {e}")
                await db.rollback()

        logger.info(
            f"Thread data fix complete. Processed {threads_processed} threads and added/updated {total_replies_added} replies."
        )
        return {
            "threads_processed": threads_processed,
            "replies_added": total_replies_added,
        }

    except Exception as e:
        logger.error(f"Error fixing thread data: {str(e)}")
        await db.rollback()
        raise
    finally:
        await db.close()


async def main():
    """Main entry point for the script."""
    try:
        # Parse command line arguments for channel_id
        import argparse

        parser = argparse.ArgumentParser(description="Fix thread data in the database")
        parser.add_argument("--channel", help="Channel ID to process (optional)")
        parser.add_argument(
            "--max-threads",
            type=int,
            default=50,
            help="Maximum number of threads to process",
        )
        args = parser.parse_args()

        result = await fix_thread_data(channel_id=args.channel, max_threads=args.max_threads)
        logger.info(
            f"Script completed successfully. Processed {result['threads_processed']} threads, added {result['replies_added']} replies."
        )
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
