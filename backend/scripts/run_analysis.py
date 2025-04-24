"""
End-to-end test script for the unified analysis flow.

This script tests both the single-channel and multi-channel analysis flows to ensure they
work consistently with the new unified approach using CrossResourceReport records.
"""

import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# We need to add the parent directory to the path to import the app modules
sys.path.insert(0, ".")

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.integration import (
    Integration,
    IntegrationType,
    ResourceType,
    ServiceResource,
)
from app.models.reports import (
    AnalysisResourceType,
    AnalysisType,
    CrossResourceReport,
    ReportStatus,
    ResourceAnalysis,
)
from app.models.slack import SlackChannel, SlackWorkspace


async def get_test_integration(db: AsyncSession) -> Optional[Dict[str, Any]]:
    """
    Find a suitable Slack integration for testing.
    """
    stmt = (
        select(Integration)
        .where(
            Integration.service_type == IntegrationType.SLACK,
            Integration.status == "active",
        )
        .limit(1)
    )

    result = await db.execute(stmt)
    integration = result.scalar_one_or_none()

    if not integration:
        logger.error("No active Slack integration found for testing")
        return None

    # Get related workspace
    metadata = integration.integration_metadata or {}
    slack_workspace_id = metadata.get("slack_id")

    if not slack_workspace_id:
        logger.error(f"Integration {integration.id} has no Slack workspace ID")
        return None

    workspace_stmt = select(SlackWorkspace).where(
        SlackWorkspace.slack_id == slack_workspace_id
    )
    workspace_result = await db.execute(workspace_stmt)
    workspace = workspace_result.scalar_one_or_none()

    if not workspace:
        logger.error(f"No workspace found for Slack ID {slack_workspace_id}")
        return None

    # Find a channel that's suitable for testing
    resource_stmt = (
        select(ServiceResource)
        .where(
            ServiceResource.integration_id == integration.id,
            ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
        )
        .order_by(ServiceResource.created_at.desc())
        .limit(1)
    )

    resource_result = await db.execute(resource_stmt)
    channel_resource = resource_result.scalar_one_or_none()

    if not channel_resource:
        logger.error(f"No channel resources found for integration {integration.id}")
        return None

    # Find the corresponding SlackChannel
    channel_stmt = select(SlackChannel).where(SlackChannel.id == channel_resource.id)
    channel_result = await db.execute(channel_stmt)
    channel = channel_result.scalar_one_or_none()

    if not channel:
        # Create a new SlackChannel from the resource
        logger.info(f"Creating SlackChannel for resource {channel_resource.id}")
        channel = SlackChannel(
            id=channel_resource.id,
            workspace_id=workspace.id,
            slack_id=channel_resource.external_id,
            name=channel_resource.name.lstrip("#"),
            type="public",
            is_selected_for_analysis=True,
            is_supported=True,
            last_sync_at=datetime.utcnow(),
        )
        db.add(channel)
        await db.commit()

    return {
        "integration": integration,
        "workspace": workspace,
        "channel_resource": channel_resource,
        "channel": channel,
    }


async def test_unified_single_channel_analysis(
    db: AsyncSession, test_data: Dict[str, Any]
) -> bool:
    """
    Test creating a single-channel analysis using the unified approach.
    """
    logger.info("=== Testing Unified Single-Channel Analysis ===")

    integration = test_data["integration"]
    workspace = test_data["workspace"]
    channel = test_data["channel"]

    # Create a CrossResourceReport
    report_uuid = uuid.uuid4()

    # Log the workspace and team_id status for debugging
    logger.info(f"Creating CrossResourceReport with workspace ID: {workspace.id}")

    # Check if workspace.team_id is None and handle it gracefully
    team_id = workspace.team_id
    if team_id is None:
        # If workspace.team_id is None, try to get it from the integration's owner_team_id
        logger.warning(
            f"Workspace {workspace.id} has null team_id, using integration.owner_team_id instead"
        )
        team_id = integration.owner_team_id

        if team_id is None:
            # If still no team_id, log error and raise exception
            logger.error(
                f"Cannot create CrossResourceReport: No valid team_id found in workspace {workspace.id} or integration {integration.id}"
            )
            raise ValueError(
                "Could not determine team_id for CrossResourceReport. Please check workspace and integration configuration."
            )

        logger.info(
            f"Using integration.owner_team_id: {team_id} for CrossResourceReport"
        )
    else:
        logger.info(f"Using workspace.team_id: {team_id} for CrossResourceReport")

    # Define date range for analysis
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)

    # Create the CrossResourceReport
    cross_report = CrossResourceReport(
        id=report_uuid,
        team_id=team_id,
        title=f"Test Analysis of {channel.name}",
        description=f"Single-channel analysis of {channel.name} from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        status=ReportStatus.COMPLETED,
        date_range_start=start_date,
        date_range_end=end_date,
        report_parameters={
            "include_threads": True,
            "include_reactions": True,
            "model": "claude-3-haiku-20240307",
            "single_channel_analysis": True,
            "channel_id": str(channel.id),
            "channel_name": channel.name,
        },
        comprehensive_analysis="Test analysis summary",
        comprehensive_analysis_generated_at=datetime.utcnow(),
        model_used="claude-3-haiku-20240307",
    )
    db.add(cross_report)

    # Create the ResourceAnalysis
    analysis_uuid = uuid.uuid4()
    resource_analysis = ResourceAnalysis(
        id=analysis_uuid,
        cross_resource_report_id=report_uuid,
        integration_id=integration.id,
        resource_id=channel.id,
        resource_type=AnalysisResourceType.SLACK_CHANNEL,
        analysis_type=AnalysisType.CONTRIBUTION,
        status=ReportStatus.COMPLETED,
        period_start=start_date,
        period_end=end_date,
        analysis_parameters={
            "include_threads": True,
            "include_reactions": True,
            "model": "claude-3-haiku-20240307",
            "channel_name": channel.name,
        },
        results={
            "message_count": 100,
            "participant_count": 10,
            "thread_count": 5,
            "reaction_count": 20,
        },
        resource_summary="Test channel summary",
        topic_analysis="Test topic analysis",
        contributor_insights="Test contributor insights",
        key_highlights="Test key highlights",
        model_used="claude-3-haiku-20240307",
        analysis_generated_at=datetime.utcnow(),
    )
    db.add(resource_analysis)

    try:
        await db.commit()
        logger.info(
            f"Successfully created test single-channel analysis with report ID {report_uuid} and analysis ID {analysis_uuid}"
        )

        # Verify that we can retrieve the analysis
        stmt = select(ResourceAnalysis).where(ResourceAnalysis.id == analysis_uuid)
        result = await db.execute(stmt)
        saved_analysis = result.scalar_one_or_none()

        if not saved_analysis:
            logger.error(f"Could not retrieve saved analysis with ID {analysis_uuid}")
            return False

        logger.info(f"Successfully retrieved saved analysis: {saved_analysis.id}")

        # Verify that we can retrieve the report
        stmt = select(CrossResourceReport).where(CrossResourceReport.id == report_uuid)
        result = await db.execute(stmt)
        saved_report = result.scalar_one_or_none()

        if not saved_report:
            logger.error(f"Could not retrieve saved report with ID {report_uuid}")
            return False

        logger.info(f"Successfully retrieved saved report: {saved_report.id}")

        # Record test IDs for cleanup
        test_data["single_channel_report_id"] = report_uuid
        test_data["single_channel_analysis_id"] = analysis_uuid

        return True

    except Exception as e:
        logger.error(
            f"Error creating test single-channel analysis: {str(e)}", exc_info=True
        )
        await db.rollback()
        return False


async def test_multi_channel_analysis(
    db: AsyncSession, test_data: Dict[str, Any]
) -> bool:
    """
    Test creating a multi-channel analysis (CrossResourceReport with multiple ResourceAnalysis records).
    """
    logger.info("=== Testing Multi-Channel Analysis ===")

    integration = test_data["integration"]
    workspace = test_data["workspace"]

    # Get multiple channels for this integration
    resource_stmt = (
        select(ServiceResource)
        .where(
            ServiceResource.integration_id == integration.id,
            ServiceResource.resource_type == ResourceType.SLACK_CHANNEL,
        )
        .limit(3)
    )

    resource_result = await db.execute(resource_stmt)
    channels = []

    for resource in resource_result.scalars().all():
        # Find or create SlackChannel
        channel_stmt = select(SlackChannel).where(SlackChannel.id == resource.id)
        channel_result = await db.execute(channel_stmt)
        channel = channel_result.scalar_one_or_none()

        if not channel:
            # Create a new SlackChannel from the resource
            logger.info(f"Creating SlackChannel for resource {resource.id}")
            channel = SlackChannel(
                id=resource.id,
                workspace_id=workspace.id,
                slack_id=resource.external_id,
                name=resource.name.lstrip("#"),
                type="public",
                is_selected_for_analysis=True,
                is_supported=True,
                last_sync_at=datetime.utcnow(),
            )
            db.add(channel)
            await db.commit()

        channels.append({"resource": resource, "channel": channel})

    if len(channels) < 1:
        logger.error(f"Not enough channels found for integration {integration.id}")
        return False

    # Check if workspace.team_id is None and handle it gracefully
    team_id = workspace.team_id
    if team_id is None:
        # If workspace.team_id is None, try to get it from the integration's owner_team_id
        logger.warning(
            f"Workspace {workspace.id} has null team_id, using integration.owner_team_id instead"
        )
        team_id = integration.owner_team_id

        if team_id is None:
            # If still no team_id, log error and raise exception
            logger.error(
                f"Cannot create CrossResourceReport: No valid team_id found in workspace {workspace.id} or integration {integration.id}"
            )
            raise ValueError(
                "Could not determine team_id for CrossResourceReport. Please check workspace and integration configuration."
            )

        logger.info(
            f"Using integration.owner_team_id: {team_id} for CrossResourceReport"
        )
    else:
        logger.info(f"Using workspace.team_id: {team_id} for CrossResourceReport")

    # Define date range for analysis
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)

    # Create the CrossResourceReport for multiple channels
    report_uuid = uuid.uuid4()
    channel_names = ", ".join([c["channel"].name for c in channels])

    multi_report = CrossResourceReport(
        id=report_uuid,
        team_id=team_id,
        title="Test Multi-Channel Analysis",
        description=f"Multi-channel analysis of {channel_names} from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        status=ReportStatus.COMPLETED,
        date_range_start=start_date,
        date_range_end=end_date,
        report_parameters={
            "include_threads": True,
            "include_reactions": True,
            "model": "claude-3-haiku-20240307",
            "single_channel_analysis": False,
            "channel_ids": [str(c["channel"].id) for c in channels],
            "channel_names": [c["channel"].name for c in channels],
        },
        comprehensive_analysis="Test multi-channel analysis summary",
        comprehensive_analysis_generated_at=datetime.utcnow(),
        model_used="claude-3-haiku-20240307",
    )
    db.add(multi_report)

    # Create a ResourceAnalysis for each channel
    analysis_ids = []
    for channel_data in channels:
        channel = channel_data["channel"]
        analysis_uuid = uuid.uuid4()
        analysis_ids.append(analysis_uuid)

        resource_analysis = ResourceAnalysis(
            id=analysis_uuid,
            cross_resource_report_id=report_uuid,
            integration_id=integration.id,
            resource_id=channel.id,
            resource_type=AnalysisResourceType.SLACK_CHANNEL,
            analysis_type=AnalysisType.CONTRIBUTION,
            status=ReportStatus.COMPLETED,
            period_start=start_date,
            period_end=end_date,
            analysis_parameters={
                "include_threads": True,
                "include_reactions": True,
                "model": "claude-3-haiku-20240307",
                "channel_name": channel.name,
            },
            results={
                "message_count": 50,
                "participant_count": 5,
                "thread_count": 3,
                "reaction_count": 10,
            },
            resource_summary=f"Test summary for {channel.name}",
            topic_analysis=f"Test topic analysis for {channel.name}",
            contributor_insights=f"Test contributor insights for {channel.name}",
            key_highlights=f"Test key highlights for {channel.name}",
            model_used="claude-3-haiku-20240307",
            analysis_generated_at=datetime.utcnow(),
        )
        db.add(resource_analysis)

    try:
        await db.commit()
        logger.info(
            f"Successfully created test multi-channel analysis with report ID {report_uuid} and {len(analysis_ids)} analysis records"
        )

        # Verify that we can retrieve the multi-channel report
        stmt = select(CrossResourceReport).where(CrossResourceReport.id == report_uuid)
        result = await db.execute(stmt)
        saved_report = result.scalar_one_or_none()

        if not saved_report:
            logger.error(
                f"Could not retrieve saved multi-channel report with ID {report_uuid}"
            )
            return False

        logger.info(
            f"Successfully retrieved saved multi-channel report: {saved_report.id}"
        )

        # Verify that all ResourceAnalysis records are properly associated with the report
        stmt = select(ResourceAnalysis).where(
            ResourceAnalysis.cross_resource_report_id == report_uuid
        )
        result = await db.execute(stmt)
        analyses = result.scalars().all()

        if len(analyses) != len(analysis_ids):
            logger.error(
                f"Expected {len(analysis_ids)} analyses, but found {len(analyses)}"
            )
            return False

        logger.info(
            f"Successfully retrieved all {len(analyses)} analyses associated with report {report_uuid}"
        )

        # Record test IDs for cleanup
        test_data["multi_channel_report_id"] = report_uuid
        test_data["multi_channel_analysis_ids"] = analysis_ids

        return True

    except Exception as e:
        logger.error(
            f"Error creating test multi-channel analysis: {str(e)}", exc_info=True
        )
        await db.rollback()
        return False


async def cleanup_test_data(db: AsyncSession, test_data: Dict[str, Any]) -> None:
    """
    Clean up test data created during tests.
    """
    logger.info("=== Cleaning Up Test Data ===")

    # Delete single-channel test data
    single_channel_analysis_id = test_data.get("single_channel_analysis_id")
    if single_channel_analysis_id:
        try:
            stmt = select(ResourceAnalysis).where(
                ResourceAnalysis.id == single_channel_analysis_id
            )
            result = await db.execute(stmt)
            analysis = result.scalar_one_or_none()

            if analysis:
                await db.delete(analysis)
                logger.info(f"Deleted test analysis {single_channel_analysis_id}")
        except Exception as e:
            logger.error(
                f"Error deleting test analysis {single_channel_analysis_id}: {str(e)}"
            )

    single_channel_report_id = test_data.get("single_channel_report_id")
    if single_channel_report_id:
        try:
            stmt = select(CrossResourceReport).where(
                CrossResourceReport.id == single_channel_report_id
            )
            result = await db.execute(stmt)
            report = result.scalar_one_or_none()

            if report:
                await db.delete(report)
                logger.info(f"Deleted test report {single_channel_report_id}")
        except Exception as e:
            logger.error(
                f"Error deleting test report {single_channel_report_id}: {str(e)}"
            )

    # Delete multi-channel test data
    multi_channel_analysis_ids = test_data.get("multi_channel_analysis_ids", [])
    for analysis_id in multi_channel_analysis_ids:
        try:
            stmt = select(ResourceAnalysis).where(ResourceAnalysis.id == analysis_id)
            result = await db.execute(stmt)
            analysis = result.scalar_one_or_none()

            if analysis:
                await db.delete(analysis)
                logger.info(f"Deleted test analysis {analysis_id}")
        except Exception as e:
            logger.error(f"Error deleting test analysis {analysis_id}: {str(e)}")

    multi_channel_report_id = test_data.get("multi_channel_report_id")
    if multi_channel_report_id:
        try:
            stmt = select(CrossResourceReport).where(
                CrossResourceReport.id == multi_channel_report_id
            )
            result = await db.execute(stmt)
            report = result.scalar_one_or_none()

            if report:
                await db.delete(report)
                logger.info(f"Deleted test report {multi_channel_report_id}")
        except Exception as e:
            logger.error(
                f"Error deleting test report {multi_channel_report_id}: {str(e)}"
            )

    await db.commit()
    logger.info("Cleanup completed")


async def validate_unified_reports_status(db: AsyncSession) -> Dict[str, int]:
    """
    Validate the current status of the database regarding unified reports.
    """
    logger.info("=== Validating Unified Reports Status ===")

    # Count CrossResourceReports
    stmt = select(func.count()).select_from(CrossResourceReport)
    result = await db.execute(stmt)
    report_count = result.scalar_one_or_none() or 0

    # Count ResourceAnalysis records
    stmt = select(func.count()).select_from(ResourceAnalysis)
    result = await db.execute(stmt)
    analysis_count = result.scalar_one_or_none() or 0

    # Count ResourceAnalysis records with valid CrossResourceReport links
    stmt = (
        select(func.count())
        .select_from(ResourceAnalysis)
        .where(
            ResourceAnalysis.cross_resource_report_id.in_(
                select(CrossResourceReport.id).select_from(CrossResourceReport)
            )
        )
    )
    result = await db.execute(stmt)
    valid_link_count = result.scalar_one_or_none() or 0

    # Identify ResourceAnalysis records with team_id issues
    stmt = (
        select(func.count())
        .select_from(CrossResourceReport)
        .where(CrossResourceReport.team_id.is_(None))
    )
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0

    results = {
        "total_reports": report_count,
        "total_analyses": analysis_count,
        "valid_links": valid_link_count,
        "null_team_id_reports": null_team_id_count,
    }

    logger.info(f"Database status: {json.dumps(results, indent=2)}")
    return results


async def main():
    """
    Main function to run the tests.
    """
    logger.info("Starting unified analysis flow end-to-end tests")

    db = AsyncSessionLocal()
    test_data = {}
    success = False

    try:
        # First, validate the current state of the database
        await validate_unified_reports_status(db)

        # Get test data
        test_data = await get_test_integration(db)

        if not test_data:
            logger.error("Could not find suitable test data")
            return

        # Run tests
        single_channel_success = await test_unified_single_channel_analysis(
            db, test_data
        )

        if single_channel_success:
            multi_channel_success = await test_multi_channel_analysis(db, test_data)
            success = single_channel_success and multi_channel_success

        # Validate status after tests
        await validate_unified_reports_status(db)

    except Exception as e:
        logger.error(f"Error running tests: {str(e)}", exc_info=True)
    finally:
        # Clean up test data
        if test_data:
            await cleanup_test_data(db, test_data)

        await db.close()

    # Report test results
    if success:
        logger.info("All tests PASSED! ✅")
        logger.info("The unified analysis flow is working correctly.")
    else:
        logger.error("Tests FAILED! ❌")
        logger.error("Check logs for details on issues with the unified analysis flow.")


if __name__ == "__main__":
    asyncio.run(main())
