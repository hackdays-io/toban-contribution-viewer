"""API endpoints for cross-resource reports."""

import logging
from datetime import timedelta
from typing import Dict, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.reports.schemas import (
    ChannelReportCreate,
    CrossResourceReportCreate,
    CrossResourceReportDetailResponse,
    CrossResourceReportResponse,
    CrossResourceReportUpdate,
    PaginatedResponse,
    ReportFilterParams,
    ReportGenerationResponse,
    ResourceAnalysisFilterParams,
    ResourceAnalysisResponse,
    WorkspaceIdResponse,
)
from app.core.auth import get_current_user
from app.core.team_scoped_access import check_team_access
from app.db.session import get_async_db
from app.models.integration import Integration
from app.models.reports import (
    AnalysisResourceType,
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)
from app.models.slack import SlackWorkspace
from app.models.team import Team, TeamMemberRole
from app.services.slack.utils import get_channel_message_stats

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{team_id}/cross-resource-reports",
    response_model=PaginatedResponse[CrossResourceReportResponse],
)
async def get_team_reports(
    team_id: UUID = Path(..., description="Team ID"),
    filter_params: ReportFilterParams = Depends(),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get all cross-resource reports for a team.

    Args:
        team_id: Team ID
        filter_params: Filter parameters
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of cross-resource reports
    """
    logger.debug(f"Getting cross-resource reports for team {team_id}, user {current_user['id']}")

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Build the query
    query = select(CrossResourceReport).where(CrossResourceReport.team_id == team_id)

    # Apply filters
    if filter_params.status:
        query = query.where(CrossResourceReport.status == filter_params.status.value)

    if filter_params.start_date:
        query = query.where(CrossResourceReport.date_range_start >= filter_params.start_date)

    if filter_params.end_date:
        query = query.where(CrossResourceReport.date_range_end <= filter_params.end_date)

    # For resource type filtering, we need to join with ResourceAnalysis
    if filter_params.resource_type:
        # Use exists subquery for resource type filtering
        resource_type_value = filter_params.resource_type.value
        query = query.where(
            CrossResourceReport.id.in_(
                select(ResourceAnalysis.cross_resource_report_id).where(
                    and_(
                        ResourceAnalysis.cross_resource_report_id == CrossResourceReport.id,
                        ResourceAnalysis.resource_type == resource_type_value,
                    )
                )
            )
        )

    # Sort the results
    if filter_params.sort_order == "desc":
        query = query.order_by(desc(getattr(CrossResourceReport, filter_params.sort_by)))
    else:
        query = query.order_by(getattr(CrossResourceReport, filter_params.sort_by))

    # Get total count before applying pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_count = total_result.scalar_one()

    # Apply pagination
    offset = (filter_params.page - 1) * filter_params.page_size
    query = query.offset(offset).limit(filter_params.page_size)

    # Execute the query
    result = await db.execute(query)
    reports = result.scalars().all()

    # Fetch summary statistics for each report
    report_responses = []
    for report in reports:
        # Convert to response model
        report_dict = report.__dict__.copy()

        # Add resource analysis summary statistics
        analysis_stats = await db.execute(
            select(
                func.count().label("total"),
                func.sum(case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)).label("completed"),
                func.sum(case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)).label("pending"),
                func.sum(case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)).label("failed"),
            ).where(ResourceAnalysis.cross_resource_report_id == report.id)
        )
        stats = analysis_stats.one()

        # Get types of resources
        resource_types_query = await db.execute(
            select(ResourceAnalysis.resource_type)
            .distinct()
            .where(ResourceAnalysis.cross_resource_report_id == report.id)
        )
        resource_types = [rt[0] for rt in resource_types_query.all()]

        report_dict["total_resources"] = stats.total
        report_dict["completed_analyses"] = stats.completed
        report_dict["pending_analyses"] = stats.pending
        report_dict["failed_analyses"] = stats.failed
        report_dict["resource_types"] = resource_types

        report_responses.append(report_dict)

    # Return paginated response
    return PaginatedResponse.create(
        items=report_responses, total=total_count, page=filter_params.page, page_size=filter_params.page_size
    )


@router.post(
    "/{team_id}/cross-resource-reports",
    response_model=CrossResourceReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_report(
    team_id: UUID,
    report: CrossResourceReportCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new cross-resource report for a team.

    Args:
        team_id: Team ID
        report: Report data for creation
        db: Database session
        current_user: Current authenticated user

    Returns:
        Newly created report
    """
    logger.debug(f"Creating cross-resource report for team {team_id}, user {current_user['id']}")

    # Check if user has admin or owner access to this team
    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin access to create reports",
        )

    # Verify the team exists
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    # Create a new report
    new_report = CrossResourceReport(
        team_id=team_id,
        title=report.title,
        description=report.description,
        date_range_start=report.date_range_start,
        date_range_end=report.date_range_end,
        report_parameters=report.report_parameters,
        status=ReportStatus.PENDING,
    )
    db.add(new_report)
    await db.flush()

    # If resource analyses were provided, create them
    if report.resource_analyses:
        for analysis_data in report.resource_analyses:
            # Convert enum values to the internal enum classes
            resource_type = getattr(AnalysisResourceType, analysis_data.resource_type.name)
            analysis_type = getattr(AnalysisType, analysis_data.analysis_type.name)

            # Create the resource analysis
            analysis = ResourceAnalysis(
                cross_resource_report_id=new_report.id,
                integration_id=analysis_data.integration_id,
                resource_id=analysis_data.resource_id,
                resource_type=resource_type,
                analysis_type=analysis_type,
                status=ReportStatus.PENDING,
                period_start=analysis_data.period_start,
                period_end=analysis_data.period_end,
                analysis_parameters=analysis_data.analysis_parameters,
            )
            db.add(analysis)

    await db.commit()
    await db.refresh(new_report)

    # Add summary statistics for the response
    analysis_stats = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)).label("pending"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)).label("failed"),
        ).where(ResourceAnalysis.cross_resource_report_id == new_report.id)
    )
    stats = analysis_stats.one()

    # Get types of resources
    resource_types_query = await db.execute(
        select(ResourceAnalysis.resource_type)
        .distinct()
        .where(ResourceAnalysis.cross_resource_report_id == new_report.id)
    )
    resource_types = [rt[0] for rt in resource_types_query.all()]

    # Prepare the response
    response_dict = new_report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types

    return response_dict


@router.get(
    "/{team_id}/cross-resource-reports/{report_id}",
    response_model=CrossResourceReportDetailResponse,
)
async def get_team_report(
    team_id: UUID,
    report_id: UUID,
    include_analyses: bool = Query(False, description="Include resource analyses in response"),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get details of a specific cross-resource report.

    Args:
        team_id: Team ID
        report_id: Report ID
        include_analyses: Whether to include resource analyses in the response
        db: Database session
        current_user: Current authenticated user

    Returns:
        Report details
    """
    logger.debug(f"Getting report {report_id} for team {team_id}, user {current_user['id']}")

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Build the query
    query = select(CrossResourceReport).where(
        and_(
            CrossResourceReport.id == report_id,
            CrossResourceReport.team_id == team_id,
        )
    )

    # Include resource analyses if requested
    if include_analyses:
        query = query.options(
            selectinload(CrossResourceReport.resource_analyses).joinedload(ResourceAnalysis.integration)
        )

    # Execute the query
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Add summary statistics
    analysis_stats = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)).label("pending"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)).label("failed"),
            # Add aggregated message statistics
            func.sum(ResourceAnalysis.message_count).label("total_messages"),
            func.sum(ResourceAnalysis.participant_count).label("total_participants"),
            func.sum(ResourceAnalysis.thread_count).label("total_threads"),
            func.sum(ResourceAnalysis.reaction_count).label("total_reactions"),
        ).where(ResourceAnalysis.cross_resource_report_id == report.id)
    )
    stats = analysis_stats.one()

    # Get types of resources
    resource_types_query = await db.execute(
        select(ResourceAnalysis.resource_type).distinct().where(ResourceAnalysis.cross_resource_report_id == report.id)
    )
    resource_types = [rt[0] for rt in resource_types_query.all()]

    # Prepare the response
    response_dict = report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types

    # Include aggregated statistics in the response
    response_dict["total_messages"] = stats.total_messages or 0
    response_dict["total_participants"] = stats.total_participants or 0
    response_dict["total_threads"] = stats.total_threads or 0
    response_dict["total_reactions"] = stats.total_reactions or 0
    
    # If analyses are included, set workspace_uuid for each analysis
    if include_analyses and "resource_analyses" in response_dict:
        workspace_ids = {
            analysis.integration.workspace_id
            for analysis in report.resource_analyses
            if analysis.integration and analysis.integration.workspace_id
        }
        
        # If there are workspace IDs, fetch the corresponding SlackWorkspace UUIDs
        if workspace_ids:
            workspace_result = await db.execute(
                select(SlackWorkspace.slack_id, SlackWorkspace.id)
                .where(SlackWorkspace.slack_id.in_(workspace_ids))
            )
            
            # Create a mapping of workspace_id (string) to UUID
            workspace_uuid_map = {
                slack_id: uuid 
                for slack_id, uuid in workspace_result.all()
            }
            
            # Set workspace_uuid for each analysis in the response
            for analysis in response_dict["resource_analyses"]:
                if hasattr(analysis, "integration") and analysis.integration and analysis.integration.workspace_id:
                    workspace_id = analysis.integration.workspace_id
                    if workspace_id in workspace_uuid_map:
                        setattr(analysis, "_workspace_uuid", workspace_uuid_map[workspace_id])

    return response_dict


@router.put(
    "/{team_id}/cross-resource-reports/{report_id}",
    response_model=CrossResourceReportResponse,
)
async def update_team_report(
    team_id: UUID,
    report_id: UUID,
    report_update: CrossResourceReportUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Update a cross-resource report.

    Args:
        team_id: Team ID
        report_id: Report ID to update
        report_update: Updated report data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated report data
    """
    logger.debug(f"Updating report {report_id} for team {team_id}, user {current_user['id']}")

    # Check if user has admin or owner access to this team
    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin access to update reports",
        )

    # Get the report
    result = await db.execute(
        select(CrossResourceReport).where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Prevent updating completed reports
    if report.status == ReportStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a completed report",
        )

    # Update report fields
    update_data = report_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(report, key, value)

    await db.commit()
    await db.refresh(report)

    # Add summary statistics for the response
    analysis_stats = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)).label("pending"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)).label("failed"),
            # Add aggregated message statistics
            func.sum(ResourceAnalysis.message_count).label("total_messages"),
            func.sum(ResourceAnalysis.participant_count).label("total_participants"),
            func.sum(ResourceAnalysis.thread_count).label("total_threads"),
            func.sum(ResourceAnalysis.reaction_count).label("total_reactions"),
        ).where(ResourceAnalysis.cross_resource_report_id == report.id)
    )
    stats = analysis_stats.one()

    # Get types of resources
    resource_types_query = await db.execute(
        select(ResourceAnalysis.resource_type).distinct().where(ResourceAnalysis.cross_resource_report_id == report.id)
    )
    resource_types = [rt[0] for rt in resource_types_query.all()]

    # Prepare the response
    response_dict = report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types
    # Include aggregated statistics in the response
    response_dict["total_messages"] = stats.total_messages or 0
    response_dict["total_participants"] = stats.total_participants or 0
    response_dict["total_threads"] = stats.total_threads or 0
    response_dict["total_reactions"] = stats.total_reactions or 0

    return response_dict


@router.delete("/{team_id}/cross-resource-reports/{report_id}")
async def delete_team_report(
    team_id: UUID,
    report_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Delete a cross-resource report.

    Args:
        team_id: Team ID
        report_id: Report ID to delete
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message
    """
    logger.debug(f"Deleting report {report_id} for team {team_id}, user {current_user['id']}")

    # Check if user has admin or owner access to this team
    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin access to delete reports",
        )

    # Get the report
    result = await db.execute(
        select(CrossResourceReport).where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Implement soft delete by setting is_active to False
    report.is_active = False
    await db.commit()

    return {"message": "Report deleted successfully"}


@router.get(
    "/resource-analyses/{analysis_id}/workspace",
    response_model=WorkspaceIdResponse,
    summary="Get workspace ID for a resource analysis",
    description="Retrieves the SlackWorkspace UUID for a given resource analysis ID",
)
async def get_workspace_id_for_analysis(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get the SlackWorkspace UUID for a resource analysis.
    
    This endpoint joins ResourceAnalysis with Integration to get the workspace_id,
    then joins with SlackWorkspace to get the actual workspace UUID.
    
    Args:
        analysis_id: Resource analysis ID
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        SlackWorkspace UUID and related information
    """
    logger.debug(f"Getting workspace ID for analysis {analysis_id}, user {current_user['id']}")
    
    analysis_result = await db.execute(
        select(ResourceAnalysis)
        .where(ResourceAnalysis.id == analysis_id)
    )
    analysis = analysis_result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource analysis not found",
        )
    
    # Check if user has access to the team that owns this report
    report_result = await db.execute(
        select(CrossResourceReport)
        .where(CrossResourceReport.id == analysis.cross_resource_report_id)
    )
    report = report_result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated report not found",
        )
    
    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=report.team_id, 
        user_id=current_user["id"], 
        db=db
    )
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this resource",
        )
    
    # Get the integration and workspace information
    result = await db.execute(
        select(
            ResourceAnalysis.id,
            ResourceAnalysis.integration_id,
            Integration.workspace_id,
            SlackWorkspace.id.label("slack_workspace_id"),
            SlackWorkspace.name.label("workspace_name")
        )
        .join(Integration, ResourceAnalysis.integration_id == Integration.id)
        .join(SlackWorkspace, Integration.workspace_id == SlackWorkspace.slack_id)
        .where(ResourceAnalysis.id == analysis_id)
    )
    
    workspace_info = result.one_or_none()
    
    if not workspace_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace information not found for this resource analysis",
        )
    
    # Return the workspace ID and related information
    return {
        "workspace_id": workspace_info.slack_workspace_id,
        "slack_workspace_id": workspace_info.workspace_id,
        "workspace_name": workspace_info.workspace_name,
        "integration_id": workspace_info.integration_id,
    }


@router.get(
    "/{team_id}/cross-resource-reports/{report_id}/resource-analyses",
    response_model=List[ResourceAnalysisResponse],
)
async def get_resource_analyses(
    team_id: UUID,
    report_id: UUID,
    filter_params: ResourceAnalysisFilterParams = Depends(),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get resource analyses for a cross-resource report.

    Args:
        team_id: Team ID
        report_id: Report ID
        filter_params: Filter parameters
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of resource analyses
    """
    logger.debug(f"Getting resource analyses for report {report_id}, team {team_id}, user {current_user['id']}")

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Verify the report exists and belongs to the team
    report_result = await db.execute(
        select(CrossResourceReport).where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = report_result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Build the query
    query = select(ResourceAnalysis).where(ResourceAnalysis.cross_resource_report_id == report_id)

    # Apply filters
    if filter_params.status:
        query = query.where(ResourceAnalysis.status == filter_params.status.value)

    if filter_params.resource_type:
        query = query.where(ResourceAnalysis.resource_type == filter_params.resource_type.value)

    if filter_params.analysis_type:
        query = query.where(ResourceAnalysis.analysis_type == filter_params.analysis_type.value)

    # Apply pagination
    offset = (filter_params.page - 1) * filter_params.page_size
    query = query.offset(offset).limit(filter_params.page_size)

    # Execute the query
    result = await db.execute(query)
    analyses = result.scalars().all()

    return analyses


@router.get(
    "/{team_id}/cross-resource-reports/{report_id}/resource-analyses/{analysis_id}",
    response_model=ResourceAnalysisResponse,
)
async def get_resource_analysis(
    team_id: UUID,
    report_id: UUID,
    analysis_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get details of a specific resource analysis.

    Args:
        team_id: Team ID
        report_id: Report ID
        analysis_id: Analysis ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Resource analysis details
    """
    logger.debug(f"Getting analysis {analysis_id} for report {report_id}, team {team_id}, user {current_user['id']}")

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Verify the report exists and belongs to the team
    report_result = await db.execute(
        select(CrossResourceReport).where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = report_result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Get the analysis
    analysis_result = await db.execute(
        select(ResourceAnalysis).where(
            and_(
                ResourceAnalysis.id == analysis_id,
                ResourceAnalysis.cross_resource_report_id == report_id,
            )
        )
    )
    analysis = analysis_result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource analysis not found",
        )

    return analysis


@router.get(
    "/{team_id}/cross-resource-reports/{report_id}/resource-analyses/{analysis_id}/task-status",
)
async def get_resource_analysis_task_status(
    team_id: UUID,
    report_id: UUID,
    analysis_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get the status of a resource analysis task.

    Args:
        team_id: Team ID
        report_id: Report ID
        analysis_id: Analysis ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Task status information
    """
    logger.debug(
        f"Getting task status for analysis {analysis_id}, report {report_id}, team {team_id}, user {current_user['id']}"
    )

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Verify the report exists and belongs to the team
    report_result = await db.execute(
        select(CrossResourceReport).where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = report_result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Get the analysis
    analysis_result = await db.execute(
        select(ResourceAnalysis).where(
            and_(
                ResourceAnalysis.id == analysis_id,
                ResourceAnalysis.cross_resource_report_id == report_id,
            )
        )
    )
    analysis = analysis_result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource analysis not found",
        )

    # Get the task status
    from app.services.analysis.task_scheduler import ResourceAnalysisTaskScheduler

    task_status = ResourceAnalysisTaskScheduler.get_task_status(analysis_id)

    # Return the combined status
    return {
        "analysis_id": str(analysis_id),
        "database_status": analysis.status,
        "task_status": task_status,
        "is_running": task_status == "RUNNING",
        "last_updated": (analysis.updated_at.isoformat() if analysis.updated_at else None),
    }


@router.post(
    "/{team_id}/cross-resource-reports/{report_id}/generate",
    response_model=ReportGenerationResponse,
)
async def generate_report(
    team_id: UUID,
    report_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Trigger the generation of a cross-resource report.

    Args:
        team_id: Team ID
        report_id: Report ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status of the report generation request
    """
    logger.debug(f"Generating report {report_id} for team {team_id}, user {current_user['id']}")

    # Check if user has admin or owner access to this team
    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin access to generate reports",
        )

    # Get the report
    result = await db.execute(
        select(CrossResourceReport)
        .options(selectinload(CrossResourceReport.resource_analyses))
        .where(
            and_(
                CrossResourceReport.id == report_id,
                CrossResourceReport.team_id == team_id,
            )
        )
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Check if the report has already been generated or is in progress
    if report.status == ReportStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report has already been generated",
        )

    if report.status == ReportStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report generation is already in progress",
        )

    # Update report status to IN_PROGRESS
    report.status = ReportStatus.IN_PROGRESS

    # Count existing resource analyses
    existing_analyses_count = len(report.resource_analyses)

    # If there are no resource analyses yet, we need to create them based on report parameters
    if existing_analyses_count == 0:
        # In a real implementation, this would involve:
        # 1. Getting available resources based on report parameters
        # 2. Creating ResourceAnalysis entries for each resource
        # 3. Triggering background tasks to perform the analyses

        # For this implementation, we'll just create a placeholder response
        # In practice, you would have a service class that handles this logic

        # Placeholder for the number of analyses that would be created
        analyses_created = 0

        # Update the response based on what would happen in a complete implementation
        response = ReportGenerationResponse(
            report_id=report_id,
            status=ReportStatus.IN_PROGRESS,
            resource_analyses_created=analyses_created,
            message="Report generation started. Resource analyses will be processed in the background.",
        )
    else:
        # If analyses already exist, just update their status
        for analysis in report.resource_analyses:
            if analysis.status == ReportStatus.PENDING or analysis.status == ReportStatus.FAILED:
                analysis.status = ReportStatus.PENDING

        response = ReportGenerationResponse(
            report_id=report_id,
            status=ReportStatus.IN_PROGRESS,
            resource_analyses_created=0,
            message=f"Report generation restarted with {existing_analyses_count} existing analyses.",
        )

    await db.commit()

    # Trigger background tasks
    from app.services.analysis.task_scheduler import ResourceAnalysisTaskScheduler

    scheduled_count = await ResourceAnalysisTaskScheduler.schedule_analyses_for_report(report_id=report_id, db=db)

    # Update the response message
    response.message += f" Scheduled {scheduled_count} analysis tasks."

    return response


@router.post(
    "/{team_id}/channel-reports",
    response_model=CrossResourceReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new channel-based report",
    description="Creates a new report for analyzing one or more Slack channels with specific date range and options",
)
async def create_channel_report(
    team_id: UUID,
    report_data: ChannelReportCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new channel-based report for one or more Slack channels.
    This endpoint provides a simplified interface for creating cross-resource reports
    specifically for Slack channel analysis.

    Args:
        team_id: Team ID
        report_data: Report creation data including channels and parameters
        db: Database session
        current_user: Current authenticated user

    Returns:
        Newly created report with generation status
    """
    logger.debug(
        f"Creating channel report for team {team_id}, user {current_user['id']} "
        f"with {len(report_data.channels)} channels"
    )

    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN, TeamMemberRole.MEMBER],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to create reports for this team",
        )

    # Verify there are channels to analyze
    if not report_data.channels or len(report_data.channels) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one channel must be specified for analysis",
        )

    # Generate default title and description if not provided
    title = report_data.title or (
        f"Multi-channel Analysis ({len(report_data.channels)} channels)"
        if len(report_data.channels) > 1
        else f"Analysis of #{report_data.channels[0]['name']}"
    )

    description = report_data.description or (
        f"Analysis of {len(report_data.channels)} Slack channels"
        if len(report_data.channels) > 1
        else f"Analysis of Slack channel #{report_data.channels[0]['name']}"
    )

    # Format dates to ensure consistent handling
    try:
        start_date = report_data.start_date
        end_date = report_data.end_date

        # For security, limit the date range to something reasonable
        max_days = 180  # 6 months
        date_difference = (end_date - start_date).days
        if date_difference > max_days:
            logger.warning(
                f"Requested date range of {date_difference} days exceeds maximum of {max_days} days. "
                f"Limiting to {max_days} days."
            )
            start_date = end_date - timedelta(days=max_days)
    except Exception as e:
        logger.error(f"Error formatting dates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {str(e)}",
        )

    # Create the report in pending status
    new_report = CrossResourceReport(
        id=uuid4(),  # Generate a new UUID for the report
        team_id=team_id,
        title=title,
        description=description,
        date_range_start=start_date,
        date_range_end=end_date,
        status=ReportStatus.PENDING,
        report_parameters={
            "include_threads": report_data.include_threads,
            "include_reactions": report_data.include_reactions,
            "analysis_type": report_data.analysis_type,
            "channel_count": len(report_data.channels),
        },
    )
    db.add(new_report)
    await db.flush()

    # Determine the analysis type
    try:
        # Convert the provided analysis type string to proper enum case
        analysis_type_str = report_data.analysis_type.upper()
        # Verify it's a valid analysis type
        analysis_type = getattr(AnalysisType, analysis_type_str)
    except (AttributeError, ValueError):
        logger.warning(f"Invalid analysis type: {report_data.analysis_type}. Using CONTRIBUTION.")
        analysis_type = AnalysisType.CONTRIBUTION

    # Create ResourceAnalysis entries for each channel
    resource_analyses = []
    for channel in report_data.channels:
        # Extract required fields
        try:
            channel_id = UUID(channel["id"])
            integration_id = UUID(channel["integration_id"])
        except (KeyError, ValueError) as e:
            logger.error(f"Invalid channel data: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid channel data: {str(e)}",
            )

        # Get initial message statistics for the channel
        channel_stats = await get_channel_message_stats(
            db=db, channel_id=channel_id, start_date=start_date, end_date=end_date
        )

        logger.info(
            f"Initial stats for channel {channel.get('name')}: "
            f"messages={channel_stats['message_count']}, "
            f"participants={channel_stats['participant_count']}, "
            f"threads={channel_stats['thread_count']}, "
            f"reactions={channel_stats['reaction_count']}"
        )

        # Create the resource analysis record with initial statistics
        analysis = ResourceAnalysis(
            id=uuid4(),  # Generate a new UUID for each analysis
            cross_resource_report_id=new_report.id,
            integration_id=integration_id,
            resource_id=channel_id,
            resource_type=AnalysisResourceType.SLACK_CHANNEL,
            analysis_type=analysis_type,
            status=ReportStatus.PENDING,
            period_start=start_date,
            period_end=end_date,
            # Include statistics from database
            message_count=channel_stats["message_count"],
            participant_count=channel_stats["participant_count"],
            thread_count=channel_stats["thread_count"],
            reaction_count=channel_stats["reaction_count"],
            analysis_parameters={
                "include_threads": report_data.include_threads,
                "include_reactions": report_data.include_reactions,
                "channel_name": channel.get("name", "Unknown"),
            },
        )
        db.add(analysis)
        resource_analyses.append(analysis)

    # Commit all changes
    await db.commit()
    await db.refresh(new_report)

    # Log what was created
    logger.info(f"Created report {new_report.id} with {len(resource_analyses)} channel analyses")

    # Trigger background task to start the analysis process
    from app.services.analysis.task_scheduler import ResourceAnalysisTaskScheduler

    scheduled_count = await ResourceAnalysisTaskScheduler.schedule_analyses_for_report(report_id=new_report.id, db=db)

    logger.info(f"Scheduled {scheduled_count} analysis tasks for report {new_report.id}")

    # Get summary statistics for the response
    analysis_stats = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)).label("pending"),
            func.sum(case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)).label("failed"),
            # Add aggregated stats across all channels
            func.sum(ResourceAnalysis.message_count).label("total_messages"),
            func.sum(ResourceAnalysis.participant_count).label("total_participants"),
            func.sum(ResourceAnalysis.thread_count).label("total_threads"),
            func.sum(ResourceAnalysis.reaction_count).label("total_reactions"),
        ).where(ResourceAnalysis.cross_resource_report_id == new_report.id)
    )
    stats = analysis_stats.one()

    # Get types of resources
    resource_types_query = await db.execute(
        select(ResourceAnalysis.resource_type)
        .distinct()
        .where(ResourceAnalysis.cross_resource_report_id == new_report.id)
    )
    resource_types = [rt[0] for rt in resource_types_query.all()]

    # Add summary message counts to report parameters
    updated_params = new_report.report_parameters.copy() if new_report.report_parameters else {}
    updated_params.update(
        {
            "total_messages": stats.total_messages or 0,
            "total_participants": stats.total_participants or 0,
            "total_threads": stats.total_threads or 0,
            "total_reactions": stats.total_reactions or 0,
        }
    )
    new_report.report_parameters = updated_params
    await db.commit()

    # Prepare the response
    response_dict = new_report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types
    # Include the counts in the response
    response_dict["total_messages"] = stats.total_messages or 0
    response_dict["total_participants"] = stats.total_participants or 0
    response_dict["total_threads"] = stats.total_threads or 0
    response_dict["total_reactions"] = stats.total_reactions or 0

    return response_dict
