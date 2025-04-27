"""
Tests for resource analysis API endpoints.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration, ResourceType
from app.models.reports import (
    AnalysisResourceType,
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)
from app.models.slack import SlackChannel
from app.models.team import Team
from app.services.analysis.task_scheduler import ResourceAnalysisTaskScheduler


@pytest.mark.skip(reason="Integration test needs to be set up with appropriate fixtures")
@pytest.mark.asyncio
async def test_trigger_resource_analysis(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_team: Team,
    team_auth_headers,
):
    """Test triggering a resource analysis."""
    # Create test data (report and resource)
    now = datetime.utcnow()

    # Create a slack channel to analyze
    slack_channel = SlackChannel(
        id=uuid.uuid4(),
        team_id=test_team.id,
        name="test-channel",
        slack_id="C12345",
        workspace_id=uuid.uuid4(),
        type="public",
        is_private=False,
        is_archived=False,
        member_count=10,
    )

    # Create an integration (slack workspace)
    integration = Integration(
        id=uuid.uuid4(),
        team_id=test_team.id,
        name="Test Workspace",
        service_type="SLACK",
        external_id="T12345",
        status="ACTIVE",
    )

    # Create a report
    report = CrossResourceReport(
        id=uuid.uuid4(),
        team_id=test_team.id,
        title="Test Report",
        description="Test Description",
        status=ReportStatus.PENDING,
        date_range_start=now - timedelta(days=30),
        date_range_end=now,
    )

    db_session.add_all([slack_channel, integration, report])
    await db_session.commit()

    # Request data
    request_data = {
        "resource_id": str(slack_channel.id),
        "resource_type": ResourceType.SLACK_CHANNEL,
        "integration_id": str(integration.id),
        "analysis_type": AnalysisType.CONTRIBUTION,
        "analysis_parameters": {"include_threads": True},
    }

    # Mock the schedule_analysis method to verify it's called
    original_schedule = ResourceAnalysisTaskScheduler.schedule_analysis

    try:
        # Replace with mock
        schedule_called = False

        async def mock_schedule_analysis(analysis_id, db=None):
            nonlocal schedule_called
            schedule_called = True
            return True

        ResourceAnalysisTaskScheduler.schedule_analysis = mock_schedule_analysis

        # Make the request
        response = await async_client.post(
            f"/api/v1/reports/{test_team.id}/cross-resource-reports/{report.id}/resources",
            json=request_data,
            headers=team_auth_headers,
        )

        # Verify response
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["resource_id"] == str(slack_channel.id)
        assert data["resource_type"] == ResourceType.SLACK_CHANNEL
        assert data["analysis_type"] == AnalysisType.CONTRIBUTION
        assert data["status"] == ReportStatus.PENDING.value

        # Verify the ResourceAnalysis was created in DB
        result = await db_session.execute(
            select(ResourceAnalysis).where(
                ResourceAnalysis.cross_resource_report_id == report.id,
                ResourceAnalysis.resource_id == slack_channel.id,
            )
        )
        analysis = result.scalar_one_or_none()
        assert analysis is not None

        # Verify the scheduler was called
        assert schedule_called is True

    finally:
        # Restore original method
        ResourceAnalysisTaskScheduler.schedule_analysis = original_schedule


@pytest.mark.skip(reason="Integration test needs to be set up with appropriate fixtures")
@pytest.mark.asyncio
async def test_get_resource_analyses(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_team: Team,
    team_auth_headers,
):
    """Test getting all resource analyses for a report."""
    # Create test data
    now = datetime.utcnow()

    # Create a report
    report = CrossResourceReport(
        id=uuid.uuid4(),
        team_id=test_team.id,
        title="Test Report",
        description="Test Description",
        status=ReportStatus.IN_PROGRESS,
        date_range_start=now - timedelta(days=30),
        date_range_end=now,
    )

    # Create some resource analyses
    resource_id1 = uuid.uuid4()
    resource_id2 = uuid.uuid4()

    analysis1 = ResourceAnalysis(
        id=uuid.uuid4(),
        cross_resource_report_id=report.id,
        resource_id=resource_id1,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        integration_id=uuid.uuid4(),
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.COMPLETED,
        period_start=now - timedelta(days=30),
        period_end=now,
        resource_summary="Test summary 1",
    )

    analysis2 = ResourceAnalysis(
        id=uuid.uuid4(),
        cross_resource_report_id=report.id,
        resource_id=resource_id2,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        integration_id=uuid.uuid4(),
        analysis_type=AnalysisType.TOPICS,
        status=ReportStatus.IN_PROGRESS,
        period_start=now - timedelta(days=30),
        period_end=now,
    )

    db_session.add_all([report, analysis1, analysis2])
    await db_session.commit()

    # Make the request
    response = await async_client.get(
        f"/api/v1/reports/{test_team.id}/cross-resource-reports/{report.id}/resources",
        headers=team_auth_headers,
    )

    # Verify response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 2

    # Sort by ID to ensure consistent testing
    data.sort(key=lambda x: x["id"])
    resource_analyses = [analysis1, analysis2]
    resource_analyses.sort(key=lambda x: str(x.id))

    for i, analysis in enumerate(resource_analyses):
        assert data[i]["id"] == str(analysis.id)
        assert data[i]["resource_id"] == str(analysis.resource_id)
        assert data[i]["resource_type"] == analysis.resource_type
        assert data[i]["analysis_type"] == analysis.analysis_type
        assert data[i]["status"] == analysis.status.value


@pytest.mark.skip(reason="Integration test needs to be set up with appropriate fixtures")
@pytest.mark.asyncio
async def test_get_resource_analysis_detail(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_team: Team,
    team_auth_headers,
):
    """Test getting a specific resource analysis."""
    # Create test data
    now = datetime.utcnow()

    # Create a report
    report = CrossResourceReport(
        id=uuid.uuid4(),
        team_id=test_team.id,
        title="Test Report",
        description="Test Description",
        status=ReportStatus.IN_PROGRESS,
        date_range_start=now - timedelta(days=30),
        date_range_end=now,
    )

    # Create a resource analysis
    resource_id = uuid.uuid4()

    analysis = ResourceAnalysis(
        id=uuid.uuid4(),
        cross_resource_report_id=report.id,
        resource_id=resource_id,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        integration_id=uuid.uuid4(),
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.COMPLETED,
        period_start=now - timedelta(days=30),
        period_end=now,
        resource_summary="Test detailed summary",
        contributor_insights="Test contributor insights",
        key_highlights="Test highlights",
        results={"test": "results"},
    )

    db_session.add_all([report, analysis])
    await db_session.commit()

    # Make the request
    response = await async_client.get(
        f"/api/v1/reports/{test_team.id}/cross-resource-reports/{report.id}/resources/{analysis.id}",
        headers=team_auth_headers,
    )

    # Verify response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(analysis.id)
    assert data["resource_id"] == str(analysis.resource_id)
    assert data["resource_type"] == analysis.resource_type
    assert data["analysis_type"] == analysis.analysis_type
    assert data["status"] == analysis.status.value
    assert data["resource_summary"] == analysis.resource_summary
    assert data["contributor_insights"] == analysis.contributor_insights
    assert data["key_highlights"] == analysis.key_highlights
    assert data["results"]["test"] == "results"


@pytest.mark.skip(reason="Integration test needs to be set up with appropriate fixtures")
@pytest.mark.asyncio
async def test_retry_resource_analysis(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_team: Team,
    team_auth_headers,
):
    """Test retrying a failed resource analysis."""
    # Create test data
    now = datetime.utcnow()

    # Create a report
    report = CrossResourceReport(
        id=uuid.uuid4(),
        team_id=test_team.id,
        title="Test Report",
        description="Test Description",
        status=ReportStatus.IN_PROGRESS,
        date_range_start=now - timedelta(days=30),
        date_range_end=now,
    )

    # Create a resource analysis that has failed
    resource_id = uuid.uuid4()

    analysis = ResourceAnalysis(
        id=uuid.uuid4(),
        cross_resource_report_id=report.id,
        resource_id=resource_id,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        integration_id=uuid.uuid4(),
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.FAILED,
        period_start=now - timedelta(days=30),
        period_end=now,
        results={"error": "Test error message"},
    )

    db_session.add_all([report, analysis])
    await db_session.commit()

    # Mock the schedule_analysis method to verify it's called
    original_schedule = ResourceAnalysisTaskScheduler.schedule_analysis

    try:
        # Replace with mock
        schedule_called = False

        async def mock_schedule_analysis(analysis_id, db=None):
            nonlocal schedule_called
            schedule_called = True
            return True

        ResourceAnalysisTaskScheduler.schedule_analysis = mock_schedule_analysis

        # Make the request
        response = await async_client.post(
            f"/api/v1/reports/{test_team.id}/cross-resource-reports/{report.id}/resources/{analysis.id}/retry",
            headers=team_auth_headers,
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(analysis.id)
        assert data["status"] == ReportStatus.PENDING.value

        # Verify the ResourceAnalysis was updated in DB
        await db_session.refresh(analysis)
        assert analysis.status == ReportStatus.PENDING

        # Verify the scheduler was called
        assert schedule_called is True

    finally:
        # Restore original method
        ResourceAnalysisTaskScheduler.schedule_analysis = original_schedule


@pytest.mark.skip(reason="Integration test needs to be set up with appropriate fixtures")
@pytest.mark.asyncio
async def test_get_task_status(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_team: Team,
    team_auth_headers,
):
    """Test getting the status of a running task."""
    # Create test data
    now = datetime.utcnow()

    # Create a report
    report = CrossResourceReport(
        id=uuid.uuid4(),
        team_id=test_team.id,
        title="Test Report",
        description="Test Description",
        status=ReportStatus.IN_PROGRESS,
        date_range_start=now - timedelta(days=30),
        date_range_end=now,
    )

    # Create a resource analysis
    resource_id = uuid.uuid4()

    analysis = ResourceAnalysis(
        id=uuid.uuid4(),
        cross_resource_report_id=report.id,
        resource_id=resource_id,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        integration_id=uuid.uuid4(),
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.IN_PROGRESS,
        period_start=now - timedelta(days=30),
        period_end=now,
    )

    db_session.add_all([report, analysis])
    await db_session.commit()

    # Mock the get_task_status method
    original_get_status = ResourceAnalysisTaskScheduler.get_task_status

    try:
        # Replace with mock
        ResourceAnalysisTaskScheduler.get_task_status = lambda analysis_id: "RUNNING"

        # Make the request
        response = await async_client.get(
            f"/api/v1/reports/{test_team.id}/cross-resource-reports/{report.id}/resources/{analysis.id}/status",
            headers=team_auth_headers,
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "RUNNING"
        assert data["analysis_id"] == str(analysis.id)

    finally:
        # Restore original method
        ResourceAnalysisTaskScheduler.get_task_status = original_get_status
