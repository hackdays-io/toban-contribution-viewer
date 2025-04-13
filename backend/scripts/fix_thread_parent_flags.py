"""
Script to fix thread parent flags in the SlackMessage table.

This script updates existing messages in the database to correctly mark thread parents
based on the revised logic:
A message is a thread parent if it has replies (reply_count > 0) AND
either thread_ts equals its own ts or thread_ts is None.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the parent directory to sys.path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

# Import after sys.path is updated - these imports must be here, ignore E402
# flake8: noqa: E402
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.session import async_engine, get_async_db
from app.models.slack import SlackMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def fix_thread_parent_flags():
    """
    Update all messages in the database to correctly mark thread parents.
    """
    logger.info("Starting thread parent flag fix script")

    # Create database tables if they don't exist (in case of new setup)
    async with async_engine.begin() as conn:
        # This is a no-op if tables already exist
        await conn.run_sync(Base.metadata.create_all)

    # Get a database session - access the first value in the generator
    db_gen = get_async_db()
    db: AsyncSession = await db_gen.__anext__()

    try:
        # First, get all messages with reply_count > 0
        query = select(SlackMessage).where(SlackMessage.reply_count > 0)
        result = await db.execute(query)
        potential_parents = result.scalars().all()

        logger.info(f"Found {len(potential_parents)} messages with reply_count > 0")

        # Track how many messages are updated
        updated_count = 0

        # Update each message that should be a thread parent but isn't
        for message in potential_parents:
            # Check if thread_ts equals message's ts or is None
            should_be_parent = message.reply_count > 0 and (
                message.thread_ts == message.slack_ts or message.thread_ts is None
            )

            if should_be_parent and not message.is_thread_parent:
                # Update this message to be a thread parent
                message.is_thread_parent = True
                updated_count += 1
                logger.info(
                    f"Marking message {message.slack_ts} as thread parent (reply_count={message.reply_count})"
                )

        # Commit all changes
        await db.commit()

        logger.info(f"Fixed {updated_count} messages, marking them as thread parents")

        # Also run a SQL update for efficiency to catch any that were missed
        sql = """
        UPDATE slackmessage
        SET is_thread_parent = TRUE
        WHERE reply_count > 0
          AND (thread_ts = slack_ts OR thread_ts IS NULL)
          AND is_thread_parent = FALSE
        """

        result = await db.execute(text(sql))
        sql_updated = result.rowcount

        if sql_updated > 0:
            await db.commit()
            logger.info(f"SQL update fixed an additional {sql_updated} messages")

        # Total number of messages fixed
        total_fixed = updated_count + sql_updated
        logger.info(f"Total messages fixed: {total_fixed}")

        return total_fixed

    except Exception as e:
        logger.error(f"Error fixing thread parent flags: {str(e)}")
        await db.rollback()
        raise
    finally:
        await db.close()


async def main():
    """Main entry point for the script."""
    try:
        total_fixed = await fix_thread_parent_flags()
        logger.info(f"Script completed successfully. Fixed {total_fixed} messages.")
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
