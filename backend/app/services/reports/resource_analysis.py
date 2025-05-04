"""
Utility functions for working with ResourceAnalysis models.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.integration import Integration
from app.models.reports import ResourceAnalysis
from app.models.slack import SlackWorkspace


async def get_resource_analyses_with_workspace_uuid(
    db: AsyncSession, report_id: UUID
) -> list[ResourceAnalysis]:
    """
    Load all ResourceAnalyses for a report with their associated SlackWorkspace UUIDs.
    
    This function efficiently loads all ResourceAnalyses for a given report along with
    their Integration and SlackWorkspace data in a minimal number of queries.
    
    Args:
        db: AsyncSession for database access
        report_id: UUID of the CrossResourceReport
        
    Returns:
        List of ResourceAnalysis objects with workspace_uuid properties set
    """
    stmt = (
        select(ResourceAnalysis)
        .options(
            joinedload(ResourceAnalysis.integration)
        )
        .where(ResourceAnalysis.cross_resource_report_id == report_id)
    )
    
    result = await db.execute(stmt)
    analyses = result.unique().scalars().all()
    
    if not analyses:
        return []
    
    workspace_ids = {
        analysis.integration.workspace_id
        for analysis in analyses
        if analysis.integration and analysis.integration.workspace_id
    }
    
    if not workspace_ids:
        return analyses
    
    workspace_stmt = (
        select(SlackWorkspace)
        .where(SlackWorkspace.slack_id.in_(workspace_ids))
    )
    
    workspace_result = await db.execute(workspace_stmt)
    workspaces = {
        workspace.slack_id: workspace.id
        for workspace in workspace_result.scalars().all()
    }
    
    for analysis in analyses:
        if (
            analysis.integration 
            and analysis.integration.workspace_id 
            and analysis.integration.workspace_id in workspaces
        ):
            setattr(analysis, "_workspace_uuid", workspaces[analysis.integration.workspace_id])
    
    return analyses
