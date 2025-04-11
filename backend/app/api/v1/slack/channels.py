"""
Slack channels API routes.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.services.slack.channels import ChannelService

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["slack_channels"])


class ChannelSelectionRequest(BaseModel):
    """Request model for selecting channels for analysis."""

    channel_ids: List[str]


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
) -> Dict[str, Any]:
    """
    Sync channels from Slack API to database.

    Args:
        workspace_id: UUID of the workspace
        db: Database session
        limit: Maximum number of channels to fetch per request
        sync_all_pages: Whether to sync all pages of channels

    Returns:
        Dictionary with sync results
    """
    try:
        # Convert sync_all_pages integer to boolean
        sync_all = bool(sync_all_pages)

        logger.info(
            f"Starting channel sync for workspace {workspace_id} with limit={limit}, sync_all_pages={sync_all}"
        )

        created, updated, total = await ChannelService.sync_channels_from_slack(
            db=db, workspace_id=workspace_id, limit=limit, sync_all_pages=sync_all
        )

        logger.info(
            f"Completed channel sync for workspace {workspace_id}: created={created}, updated={updated}, total={total}"
        )

        return {
            "status": "success",
            "message": f"Synced {total} channels ({created} created, {updated} updated)",
            "created_count": created,
            "updated_count": updated,
            "total_count": total,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing channels: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while syncing channels"
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
