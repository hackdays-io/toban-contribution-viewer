"""
Background tasks for Slack integration.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.models.slack import SlackWorkspace
from app.services.slack.workspace import WorkspaceService

# Configure logging
logger = logging.getLogger(__name__)


async def verify_all_tokens(db: AsyncSession) -> None:
    """
    Background task to verify all workspace tokens.
    
    Args:
        db: Database session
    """
    logger.info("Starting background token verification task")
    try:
        # Query for workspaces that need verification
        result = await db.execute(
            select(SlackWorkspace).where(
                SlackWorkspace.is_connected.is_(True)
            )
        )
        workspaces = result.scalars().all()
        
        if not workspaces:
            logger.info("No connected workspaces found for token verification")
            return
        
        logger.info(f"Verifying tokens for {len(workspaces)} workspaces")
        
        # Verify each workspace's token
        for workspace in workspaces:
            try:
                await WorkspaceService.verify_workspace_tokens(db, str(workspace.id))
                logger.info(f"Verified token for workspace {workspace.name} ({workspace.id})")
            except Exception as e:
                logger.error(f"Error verifying token for workspace {workspace.id}: {str(e)}")
        
        logger.info("Completed token verification task")
                
    except Exception as e:
        logger.error(f"Error in token verification task: {str(e)}")


async def update_all_workspace_metadata(db: AsyncSession) -> None:
    """
    Background task to update metadata for all connected workspaces.
    
    Args:
        db: Database session
    """
    logger.info("Starting background workspace metadata update task")
    try:
        # Query for connected workspaces
        result = await db.execute(
            select(SlackWorkspace).where(
                SlackWorkspace.is_connected.is_(True)
            )
        )
        workspaces = result.scalars().all()
        
        if not workspaces:
            logger.info("No connected workspaces found for metadata update")
            return
        
        logger.info(f"Updating metadata for {len(workspaces)} workspaces")
        
        # Update each workspace's metadata
        for workspace in workspaces:
            try:
                await WorkspaceService.update_workspace_metadata(db, workspace)
                logger.info(f"Updated metadata for workspace {workspace.name} ({workspace.id})")
            except Exception as e:
                logger.error(f"Error updating metadata for workspace {workspace.id}: {str(e)}")
        
        logger.info("Completed workspace metadata update task")
                
    except Exception as e:
        logger.error(f"Error in workspace metadata update task: {str(e)}")


# Task scheduling helpers
async def schedule_background_tasks():
    """
    Schedule and run background tasks at appropriate intervals.
    This function is meant to be run as a background task when the app starts.
    """
    logger.info("Starting Slack background task scheduler")
    
    # Create a database session for background tasks
    # Note: In a production app, you might want to use a task queue like Celery
    try:
        while True:
            try:
                # Get a new DB session
                # Make sure we use the AsyncEngine, not Engine
                from sqlalchemy.ext.asyncio import create_async_session
                from app.db.session import get_async_db
                async for db in get_async_db():
                    # Run token verification every 6 hours
                    await verify_all_tokens(db)
                    
                    # Update workspace metadata daily
                    await update_all_workspace_metadata(db)
            except Exception as e:
                logger.error(f"Error running scheduled tasks: {str(e)}")
            
            # Wait for 6 hours before running again
            await asyncio.sleep(6 * 60 * 60)  # 6 hours
            
    except asyncio.CancelledError:
        logger.info("Background task scheduler was cancelled")
    except Exception as e:
        logger.error(f"Background task scheduler failed: {str(e)}")