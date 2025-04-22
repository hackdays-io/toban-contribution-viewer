"""API endpoints for cross-resource reports."""

import logging
from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.reports.schemas import (
    CrossResourceReportCreate,
    CrossResourceReportDetailResponse,
    CrossResourceReportResponse,
    CrossResourceReportUpdate,
    ReportFilterParams,
    ReportGenerationResponse,
    ResourceAnalysisFilterParams,
    ResourceAnalysisResponse,
)
from app.core.auth import get_current_user
from app.core.team_scoped_access import check_team_access
from app.db.session import get_async_db
from app.models.reports import (
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)
from app.models.reports import ResourceType as AnalysisResourceType
from app.models.team import Team, TeamMemberRole

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{team_id}/cross-resource-reports",
    response_model=List[CrossResourceReportResponse],
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
    logger.debug(
        f"Getting cross-resource reports for team {team_id}, user {current_user['id']}"
    )

    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=team_id, user_id=current_user["id"], db=db
    )

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
        query = query.where(
            CrossResourceReport.date_range_start >= filter_params.start_date
        )

    if filter_params.end_date:
        query = query.where(
            CrossResourceReport.date_range_end <= filter_params.end_date
        )

    # For resource type filtering, we need to join with ResourceAnalysis
    if filter_params.resource_type:
        # Use exists subquery for resource type filtering
        resource_type_value = filter_params.resource_type.value
        query = query.where(
            CrossResourceReport.id.in_(
                select(ResourceAnalysis.cross_resource_report_id).where(
                    and_(
                        ResourceAnalysis.cross_resource_report_id
                        == CrossResourceReport.id,
                        ResourceAnalysis.resource_type == resource_type_value,
                    )
                )
            )
        )

    # Sort the results
    if filter_params.sort_order == "desc":
        query = query.order_by(
            desc(getattr(CrossResourceReport, filter_params.sort_by))
        )
    else:
        query = query.order_by(getattr(CrossResourceReport, filter_params.sort_by))

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
                func.sum(
                    case(
                        (ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0
                    )
                ).label("completed"),
                func.sum(
                    case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)
                ).label("pending"),
                func.sum(
                    case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)
                ).label("failed"),
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

    return report_responses


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
    logger.debug(
        f"Creating cross-resource report for team {team_id}, user {current_user['id']}"
    )

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
            resource_type = getattr(
                AnalysisResourceType, analysis_data.resource_type.name
            )
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
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)
            ).label("completed"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)
            ).label("pending"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)
            ).label("failed"),
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
    include_analyses: bool = Query(
        False, description="Include resource analyses in response"
    ),
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
    logger.debug(
        f"Getting report {report_id} for team {team_id}, user {current_user['id']}"
    )

    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=team_id, user_id=current_user["id"], db=db
    )

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
        query = query.options(selectinload(CrossResourceReport.resource_analyses))

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
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)
            ).label("completed"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)
            ).label("pending"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)
            ).label("failed"),
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

    # Prepare the response
    response_dict = report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types

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
    logger.debug(
        f"Updating report {report_id} for team {team_id}, user {current_user['id']}"
    )

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
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.COMPLETED, 1), else_=0)
            ).label("completed"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.PENDING, 1), else_=0)
            ).label("pending"),
            func.sum(
                case((ResourceAnalysis.status == ReportStatus.FAILED, 1), else_=0)
            ).label("failed"),
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

    # Prepare the response
    response_dict = report.__dict__.copy()
    response_dict["total_resources"] = stats.total
    response_dict["completed_analyses"] = stats.completed
    response_dict["pending_analyses"] = stats.pending
    response_dict["failed_analyses"] = stats.failed
    response_dict["resource_types"] = resource_types

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
    logger.debug(
        f"Deleting report {report_id} for team {team_id}, user {current_user['id']}"
    )

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
    logger.debug(
        f"Getting resource analyses for report {report_id}, team {team_id}, user {current_user['id']}"
    )

    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=team_id, user_id=current_user["id"], db=db
    )

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
    query = select(ResourceAnalysis).where(
        ResourceAnalysis.cross_resource_report_id == report_id
    )

    # Apply filters
    if filter_params.status:
        query = query.where(ResourceAnalysis.status == filter_params.status.value)

    if filter_params.resource_type:
        query = query.where(
            ResourceAnalysis.resource_type == filter_params.resource_type.value
        )

    if filter_params.analysis_type:
        query = query.where(
            ResourceAnalysis.analysis_type == filter_params.analysis_type.value
        )

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
    logger.debug(
        f"Getting analysis {analysis_id} for report {report_id}, team {team_id}, user {current_user['id']}"
    )

    # Check if user has access to this team
    has_access = await check_team_access(
        team_id=team_id, user_id=current_user["id"], db=db
    )

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
    logger.debug(
        f"Generating report {report_id} for team {team_id}, user {current_user['id']}"
    )

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
            if (
                analysis.status == ReportStatus.PENDING
                or analysis.status == ReportStatus.FAILED
            ):
                analysis.status = ReportStatus.PENDING

        response = ReportGenerationResponse(
            report_id=report_id,
            status=ReportStatus.IN_PROGRESS,
            resource_analyses_created=0,
            message=f"Report generation restarted with {existing_analyses_count} existing analyses.",
        )

    await db.commit()

    # In a real implementation, you would trigger background tasks here
    # For example:
    # asyncio.create_task(process_report(db, report_id))

    return response
