"""
Tests for CrossResourceReport and ResourceAnalysis models.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration, IntegrationType
from app.models.reports import (
    AnalysisResourceType,
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)
from app.models.team import Team
from tests.conftest import team_test_mark


@pytest.mark.asyncio
@team_test_mark
async def test_cross_resource_report_create(db_session: AsyncSession):
    """Test creating a CrossResourceReport."""
    # Create a test team first
    team = Team(
        name="Test Team",
        slug="test-team",
        description="Team for testing",
        created_by_user_id="test-user",
    )
    db_session.add(team)
    await db_session.flush()

    # Create a cross-resource report
    report = CrossResourceReport(
        team_id=team.id,
        title="Test Cross-Resource Report",
        description="Report for testing",
        status=ReportStatus.PENDING,
        date_range_start=datetime.utcnow() - timedelta(days=30),
        date_range_end=datetime.utcnow(),
        report_parameters={"include_threads": True},
    )
    db_session.add(report)
    await db_session.flush()

    # Verify the report was created with expected values
    assert report.id is not None
    assert report.team_id == team.id
    assert report.title == "Test Cross-Resource Report"
    assert report.status == ReportStatus.PENDING
    assert report.is_active is True
    assert isinstance(report.created_at, datetime)
    assert isinstance(report.updated_at, datetime)


@pytest.mark.asyncio
@team_test_mark
async def test_resource_analysis_create(db_session: AsyncSession):
    """Test creating a ResourceAnalysis."""
    # Create a test team
    team = Team(
        name="Test Team",
        slug="test-team",
        description="Team for testing",
        created_by_user_id="test-user",
    )
    db_session.add(team)

    # Create a test integration
    integration = Integration(
        name="Test Integration",
        service_type=IntegrationType.SLACK,
        owner_team_id=team.id,
        external_id="T12345",
    )
    db_session.add(integration)

    # Create a cross-resource report
    report = CrossResourceReport(
        team_id=team.id,
        title="Test Cross-Resource Report",
        description="Report for testing",
        status=ReportStatus.PENDING,
        date_range_start=datetime.utcnow() - timedelta(days=30),
        date_range_end=datetime.utcnow(),
    )
    db_session.add(report)
    await db_session.flush()

    # Create a resource analysis
    resource_id = uuid.uuid4()
    analysis = ResourceAnalysis(
        cross_resource_report_id=report.id,
        integration_id=integration.id,
        resource_id=resource_id,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.PENDING,
        period_start=datetime.utcnow() - timedelta(days=30),
        period_end=datetime.utcnow(),
        analysis_parameters={"include_threads": True},
    )
    db_session.add(analysis)
    await db_session.flush()

    # Verify the analysis was created with expected values
    assert analysis.id is not None
    assert analysis.cross_resource_report_id == report.id
    assert analysis.integration_id == integration.id
    assert analysis.resource_id == resource_id
    assert analysis.resource_type == AnalysisResourceType.SLACK_CHANNEL
    assert analysis.analysis_type == AnalysisType.CONTRIBUTION
    assert analysis.status == ReportStatus.PENDING
    assert analysis.is_active is True


@pytest.mark.asyncio
@team_test_mark
async def test_cross_resource_report_relationships(db_session: AsyncSession):
    """Test relationships between CrossResourceReport and ResourceAnalysis."""
    # Create a test team
    team = Team(
        name="Test Team",
        slug="test-team",
        description="Team for testing",
        created_by_user_id="test-user",
    )
    db_session.add(team)

    # Create a test integration
    integration = Integration(
        name="Test Integration",
        service_type=IntegrationType.SLACK,
        owner_team_id=team.id,
        external_id="T12345",
    )
    db_session.add(integration)

    # Create a cross-resource report
    report = CrossResourceReport(
        team_id=team.id,
        title="Test Cross-Resource Report",
        description="Report for testing",
        status=ReportStatus.PENDING,
        date_range_start=datetime.utcnow() - timedelta(days=30),
        date_range_end=datetime.utcnow(),
    )
    db_session.add(report)

    # Create two resource analyses
    for _ in range(2):
        analysis = ResourceAnalysis(
            cross_resource_report_id=report.id,
            integration_id=integration.id,
            resource_id=uuid.uuid4(),
            resource_type=AnalysisResourceType.SLACK_CHANNEL,
            analysis_type=AnalysisType.CONTRIBUTION,
            status=ReportStatus.PENDING,
            period_start=datetime.utcnow() - timedelta(days=30),
            period_end=datetime.utcnow(),
        )
        db_session.add(analysis)

    await db_session.flush()
    await db_session.refresh(report)

    # Verify relationships
    assert len(report.resource_analyses) == 2
    assert report.resource_analyses[0].cross_resource_report_id == report.id
    assert report.resource_analyses[1].cross_resource_report_id == report.id

    # Verify team relationship
    assert report.team_id == team.id
    await db_session.refresh(team)
    assert report.id in [r.id for r in team.cross_resource_reports]


@pytest.mark.asyncio
@team_test_mark
async def test_cascade_delete(db_session: AsyncSession):
    """Test that deleting a report cascades to its analyses."""
    # Create a test team
    team = Team(
        name="Test Team",
        slug="test-team",
        description="Team for testing",
        created_by_user_id="test-user",
    )
    db_session.add(team)

    # Create a test integration
    integration = Integration(
        name="Test Integration",
        service_type=IntegrationType.SLACK,
        owner_team_id=team.id,
        external_id="T12345",
    )
    db_session.add(integration)

    # Create a cross-resource report
    report = CrossResourceReport(
        team_id=team.id,
        title="Test Cross-Resource Report",
        description="Report for testing",
        status=ReportStatus.PENDING,
        date_range_start=datetime.utcnow() - timedelta(days=30),
        date_range_end=datetime.utcnow(),
    )
    db_session.add(report)

    # Create a resource analysis
    analysis = ResourceAnalysis(
        cross_resource_report_id=report.id,
        integration_id=integration.id,
        resource_id=uuid.uuid4(),
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.PENDING,
        period_start=datetime.utcnow() - timedelta(days=30),
        period_end=datetime.utcnow(),
    )
    db_session.add(analysis)
    await db_session.flush()

    # Get the analysis ID for later verification
    analysis_id = analysis.id

    # Now delete the report
    await db_session.delete(report)
    await db_session.flush()

    # Verify the analysis was also deleted (or at least removed from the session)
    result = await db_session.execute(
        f"SELECT COUNT(*) FROM resourceanalysis WHERE id = '{analysis_id}'"
    )
    count = result.scalar()
    assert count == 0
