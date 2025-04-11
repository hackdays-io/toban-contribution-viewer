"""
Slack channels API routes.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.models.slack import SlackWorkspace
from app.services.slack.channels import ChannelService

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["slack_channels"])


class ChannelSelectionRequest(BaseModel):
    """Request model for selecting channels for analysis."""

    channel_ids: List[str]


@router.get("/workspaces/{workspace_id}/sync-status")
async def get_sync_status(
    workspace_id: str,
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Get the current sync status for a workspace.
    
    Args:
        workspace_id: UUID of the workspace
        db: Database session
        
    Returns:
        Dictionary with sync status information
    """
    try:
        # Get workspace
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        workspace = result.scalars().first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
            
        # Get channel count
        channel_count_result = await db.execute(
            select(SlackChannel).where(SlackChannel.workspace_id == workspace_id)
        )
        channels = channel_count_result.scalars().all()
        channel_count = len(channels)
        
        # Get timestamp of most recently updated channel
        recent_channel_sync = None
        if channels:
            recent_channel_sync_times = [
                channel.last_sync_at for channel in channels 
                if channel.last_sync_at is not None
            ]
            if recent_channel_sync_times:
                recent_channel_sync = max(recent_channel_sync_times)
        
        # For is_syncing, check both the workspace status AND the timestamp
        # A workspace with status "syncing" that hasn't been updated for more than 5 minutes
        # is probably stuck, so we'll consider it not syncing anymore
        is_syncing = workspace.connection_status == "syncing"
        
        # If sync status is "syncing" but it's been more than 5 minutes since last update,
        # we'll consider the sync as completed or failed
        if is_syncing and workspace.last_sync_at:
            # Calculate time since last sync - if > 5 minutes and status is still "syncing", 
            # it's probably stuck
            sync_timeout_minutes = 5  # Consider sync complete or failed after 5 minutes
            time_since_last_sync = (datetime.utcnow() - workspace.last_sync_at).total_seconds() / 60
            
            if time_since_last_sync > sync_timeout_minutes:
                is_syncing = False
                logger.warning(
                    f"Workspace {workspace_id} has status 'syncing' but hasn't been updated for {time_since_last_sync:.1f} minutes. "
                    f"Considering sync as completed or failed."
                )
                
                # Update the workspace status to "active" so we don't keep checking
                try:
                    await db.execute(
                        update(SlackWorkspace)
                        .where(SlackWorkspace.id == workspace_id)
                        .values(connection_status="active")
                    )
                    await db.commit()
                    logger.info(f"Updated workspace {workspace_id} status from 'syncing' to 'active' due to timeout")
                except Exception as e:
                    logger.error(f"Error updating workspace status: {str(e)}")
                    await db.rollback()
        
        return {
            "status": "success",
            "workspace_status": workspace.connection_status,
            "is_syncing": is_syncing,
            "last_workspace_sync": workspace.last_sync_at,
            "last_channel_sync": recent_channel_sync,
            "channel_count": channel_count,
            "sync_time": datetime.utcnow().isoformat(),  # Add current server time for comparison
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sync status: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving sync status"
        )

@router.get("/workspaces/{workspace_id}/channels")
async def list_channels(
    workspace_id: str,
    db: AsyncSession = Depends(get_async_db),
    types: Optional[List[str]] = Query(
        None, description="Filter by channel types (public, private, mpim, im)"
    ),
    include_archived: bool = Query(False, description="Include archived channels"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Number of items per page"),
) -> Dict[str, Any]:
    """
    List channels for a workspace with pagination.

    Args:
        workspace_id: UUID of the workspace
        db: Database session
        types: Optional list of channel types to filter by
        include_archived: Whether to include archived channels
        page: Page number for pagination (1-indexed)
        page_size: Number of items per page

    Returns:
        Dictionary containing channels and pagination metadata
    """
    try:
        logger.info(
            f"Fetching channels for workspace {workspace_id} with types={types}, include_archived={include_archived}, page={page}, page_size={page_size}"
        )

        result = await ChannelService.get_channels_for_workspace(
            db=db,
            workspace_id=workspace_id,
            channel_types=types,
            include_archived=include_archived,
            page=page,
            page_size=page_size,
        )

        logger.info(
            f"Retrieved {len(result.get('channels', []))} channels for workspace {workspace_id}"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing channels: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while retrieving channel list"
        )


@router.post("/workspaces/{workspace_id}/channels/sync")
async def sync_channels(
    workspace_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    limit: int = Query(
        1000, ge=100, le=1000, description="Max channels per page to fetch"
    ),
    sync_all_pages: int = Query(
        1,
        ge=0,
        le=1,
        description="Whether to sync all pages (1) or just the first page (0)",
    ),
    batch_size: int = Query(
        200, ge=50, le=1000, description="Number of channels to process in each batch"
    ),
) -> Dict[str, Any]:
    """
    Sync channels from Slack API to database.

    This endpoint initiates a background task for syncing channels to prevent timeouts.
    It returns immediately with a status message while the sync continues in the background.

    Args:
        workspace_id: UUID of the workspace
        background_tasks: FastAPI background tasks handler
        db: Database session
        limit: Maximum number of channels to fetch per request
        sync_all_pages: Whether to sync all pages of channels
        batch_size: Number of channels to process in each batch

    Returns:
        Dictionary with status information
    """
    try:
        # Convert sync_all_pages integer to boolean
        sync_all = bool(sync_all_pages)

        # Verify the workspace exists and has a valid token
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        workspace = result.scalars().first()

        if not workspace:
            logger.error(f"Workspace not found: {workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace not found")

        if not workspace.access_token:
            logger.error(f"Workspace has no access token: {workspace_id}")
            raise HTTPException(
                status_code=400, detail="Workspace is not properly connected"
            )

        logger.info(
            f"Initiating background channel sync for workspace {workspace_id} with limit={limit}, sync_all_pages={sync_all}, batch_size={batch_size}"
        )

        # Add the sync task to background tasks
        background_tasks.add_task(
            ChannelService.sync_channels_from_slack_background,
            workspace_id=workspace_id,
            access_token=workspace.access_token,
            limit=limit,
            sync_all_pages=sync_all,
            batch_size=batch_size,
        )

        return {
            "status": "syncing",
            "message": "Channel synchronization started. This process will continue in the background and may take a few minutes for large workspaces.",
            "workspace_id": workspace_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating channel sync: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while initiating channel sync"
        )


@router.post("/workspaces/{workspace_id}/channels/select")
async def select_channels_for_analysis(
    workspace_id: str,
    selection: ChannelSelectionRequest,
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """
    Select channels for analysis.

    Args:
        workspace_id: UUID of the workspace
        selection: Channel selection request
        db: Database session

    Returns:
        Dictionary with selection results
    """
    try:
        result = await ChannelService.select_channels_for_analysis(
            db=db, workspace_id=workspace_id, channel_ids=selection.channel_ids
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error selecting channels: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while selecting channels for analysis",
        )
