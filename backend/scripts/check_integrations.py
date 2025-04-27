"""
Script to check the integration models structure and relationships.

This script validates the database structure for integrations, resources, and reports
to ensure everything is properly connected in the unified analysis flow.
"""

import asyncio
import logging
import sys
from typing import Dict

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# We need to add the parent directory to the path to import the app modules
sys.path.insert(0, ".")

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.integration import (
    Integration,
    ResourceType,
    ServiceResource,
)
from app.models.reports import CrossResourceReport, ResourceAnalysis
from app.models.slack import SlackChannel, SlackWorkspace


async def check_workspace_team_ids(db: AsyncSession) -> Dict[str, int]:
    """
    Check if SlackWorkspace records have team_ids assigned.
    """
    logger.info("Checking SlackWorkspace team_id assignments...")

    # Count total workspaces
    stmt = select(func.count()).select_from(SlackWorkspace)
    result = await db.execute(stmt)
    total_workspaces = result.scalar_one_or_none() or 0

    # Count workspaces with null team_id
    stmt = select(func.count()).select_from(SlackWorkspace).where(SlackWorkspace.team_id.is_(None))
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0

    # Calculate percentage
    percentage = 0
    if total_workspaces > 0:
        percentage = (null_team_id_count / total_workspaces) * 100

    results = {
        "total_workspaces": total_workspaces,
        "null_team_id_count": null_team_id_count,
        "percentage": f"{percentage:.1f}%",
    }

    logger.info(f"SlackWorkspace team_id check: {results}")

    if null_team_id_count > 0:
        logger.warning(f"{null_team_id_count} workspaces ({percentage:.1f}%) have null team_id values")

        # Get list of workspaces with null team_id
        stmt = select(SlackWorkspace).where(SlackWorkspace.team_id.is_(None)).limit(5)
        result = await db.execute(stmt)
        null_workspaces = result.scalars().all()

        logger.info("Sample workspaces with null team_id:")
        for workspace in null_workspaces:
            logger.info(f"  Workspace ID: {workspace.id}, Name: {workspace.name}, Slack ID: {workspace.slack_id}")

    return results


async def check_integration_team_ids(db: AsyncSession) -> Dict[str, int]:
    """
    Check if Integration records have owner_team_id assigned.
    """
    logger.info("Checking Integration owner_team_id assignments...")

    # Count total integrations
    stmt = select(func.count()).select_from(Integration)
    result = await db.execute(stmt)
    total_integrations = result.scalar_one_or_none() or 0

    # Count integrations with null owner_team_id
    stmt = select(func.count()).select_from(Integration).where(Integration.owner_team_id.is_(None))
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0

    # Calculate percentage
    percentage = 0
    if total_integrations > 0:
        percentage = (null_team_id_count / total_integrations) * 100

    results = {
        "total_integrations": total_integrations,
        "null_team_id_count": null_team_id_count,
        "percentage": f"{percentage:.1f}%",
    }

    logger.info(f"Integration owner_team_id check: {results}")

    if null_team_id_count > 0:
        logger.warning(f"{null_team_id_count} integrations ({percentage:.1f}%) have null owner_team_id values")

        # Get list of integrations with null owner_team_id
        stmt = select(Integration).where(Integration.owner_team_id.is_(None)).limit(5)
        result = await db.execute(stmt)
        null_integrations = result.scalars().all()

        logger.info("Sample integrations with null owner_team_id:")
        for integration in null_integrations:
            logger.info(f"  Integration ID: {integration.id}, Name: {integration.name}")

    return results


async def check_resource_integrations(db: AsyncSession) -> Dict[str, int]:
    """
    Check if ServiceResource records are properly linked to integrations.
    """
    logger.info("Checking ServiceResource integration links...")

    # Count total resources
    stmt = select(func.count()).select_from(ServiceResource)
    result = await db.execute(stmt)
    total_resources = result.scalar_one_or_none() or 0

    # Count resources with valid integration links
    stmt = (
        select(func.count())
        .select_from(ServiceResource)
        .where(ServiceResource.integration_id.in_(select(Integration.id).select_from(Integration)))
    )
    result = await db.execute(stmt)
    valid_link_count = result.scalar_one_or_none() or 0

    # Calculate percentage
    percentage = 0
    if total_resources > 0:
        percentage = (valid_link_count / total_resources) * 100

    results = {
        "total_resources": total_resources,
        "valid_link_count": valid_link_count,
        "percentage": f"{percentage:.1f}%",
    }

    logger.info(f"ServiceResource integration link check: {results}")

    if valid_link_count < total_resources:
        logger.warning(f"{total_resources - valid_link_count} resources have invalid integration links")

    return results


async def check_channel_resources(db: AsyncSession) -> Dict[str, int]:
    """
    Check consistency between SlackChannel and ServiceResource records.
    """
    logger.info("Checking SlackChannel and ServiceResource consistency...")

    # Count total SlackChannel records
    stmt = select(func.count()).select_from(SlackChannel)
    result = await db.execute(stmt)
    total_channels = result.scalar_one_or_none() or 0

    # Count total Slack channel resources
    stmt = (
        select(func.count())
        .select_from(ServiceResource)
        .where(ServiceResource.resource_type == ResourceType.SLACK_CHANNEL)
    )
    result = await db.execute(stmt)
    total_resources = result.scalar_one_or_none() or 0

    # Count channels that exist as resources
    stmt = (
        select(func.count())
        .select_from(SlackChannel)
        .where(
            SlackChannel.id.in_(
                select(ServiceResource.id).where(ServiceResource.resource_type == ResourceType.SLACK_CHANNEL)
            )
        )
    )
    result = await db.execute(stmt)
    matched_count = result.scalar_one_or_none() or 0

    results = {
        "total_channels": total_channels,
        "total_channel_resources": total_resources,
        "matched_count": matched_count,
        "channel_resource_ratio": f"{matched_count}/{total_channels} ({(matched_count / total_channels * 100 if total_channels else 0):.1f}%)",
    }

    logger.info(f"SlackChannel and ServiceResource consistency check: {results}")

    if matched_count < total_channels:
        logger.warning(
            f"{total_channels - matched_count} SlackChannel records don't have corresponding ServiceResource records"
        )

    return results


async def check_report_structure(db: AsyncSession) -> Dict[str, int]:
    """
    Check the new unified report structure.
    """
    logger.info("Checking unified report structure...")

    # Count CrossResourceReport records
    stmt = select(func.count()).select_from(CrossResourceReport)
    result = await db.execute(stmt)
    total_reports = result.scalar_one_or_none() or 0

    # Count ResourceAnalysis records
    stmt = select(func.count()).select_from(ResourceAnalysis)
    result = await db.execute(stmt)
    total_analyses = result.scalar_one_or_none() or 0

    # Count ResourceAnalysis records with valid report links
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

    # Calculate average analyses per report
    avg_analyses = 0
    if total_reports > 0:
        avg_analyses = total_analyses / total_reports

    results = {
        "total_reports": total_reports,
        "total_analyses": total_analyses,
        "valid_link_count": valid_link_count,
        "invalid_link_count": total_analyses - valid_link_count,
        "avg_analyses_per_report": f"{avg_analyses:.2f}",
    }

    logger.info(f"Unified report structure check: {results}")

    if valid_link_count < total_analyses:
        logger.warning(f"{total_analyses - valid_link_count} ResourceAnalysis records have invalid report links")

    return results


async def check_report_team_ids(db: AsyncSession) -> Dict[str, int]:
    """
    Check if CrossResourceReport records have team_ids assigned.
    """
    logger.info("Checking CrossResourceReport team_id assignments...")

    # Count total reports
    stmt = select(func.count()).select_from(CrossResourceReport)
    result = await db.execute(stmt)
    total_reports = result.scalar_one_or_none() or 0

    # Count reports with null team_id
    stmt = select(func.count()).select_from(CrossResourceReport).where(CrossResourceReport.team_id.is_(None))
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0

    # Calculate percentage
    percentage = 0
    if total_reports > 0:
        percentage = (null_team_id_count / total_reports) * 100

    results = {
        "total_reports": total_reports,
        "null_team_id_count": null_team_id_count,
        "percentage": f"{percentage:.1f}%",
    }

    logger.info(f"CrossResourceReport team_id check: {results}")

    if null_team_id_count > 0:
        logger.warning(f"{null_team_id_count} reports ({percentage:.1f}%) have null team_id values")

        # Get list of reports with null team_id
        stmt = select(CrossResourceReport).where(CrossResourceReport.team_id.is_(None)).limit(5)
        result = await db.execute(stmt)
        null_reports = result.scalars().all()

        logger.info("Sample reports with null team_id:")
        for report in null_reports:
            logger.info(f"  Report ID: {report.id}, Title: {report.title}")

    return results


async def main():
    """
    Main function to run all checks.
    """
    logger.info("Starting integration structure validation")

    db = AsyncSessionLocal()

    try:
        # Run all checks
        workspace_team_ids = await check_workspace_team_ids(db)
        integration_team_ids = await check_integration_team_ids(db)
        resource_integrations = await check_resource_integrations(db)
        channel_resources = await check_channel_resources(db)
        report_structure = await check_report_structure(db)
        report_team_ids = await check_report_team_ids(db)

        # Overall result summary
        logger.info("=== Validation Summary ===")

        issues_found = 0

        if workspace_team_ids["null_team_id_count"] > 0:
            issues_found += 1
            logger.warning(f"⚠️ {workspace_team_ids['null_team_id_count']} workspaces have missing team_id values")

        if integration_team_ids["null_team_id_count"] > 0:
            issues_found += 1
            logger.warning(
                f"⚠️ {integration_team_ids['null_team_id_count']} integrations have missing owner_team_id values"
            )

        if resource_integrations["valid_link_count"] < resource_integrations["total_resources"]:
            issues_found += 1
            invalid_count = resource_integrations["total_resources"] - resource_integrations["valid_link_count"]
            logger.warning(f"⚠️ {invalid_count} resources have invalid integration links")

        if channel_resources["matched_count"] < channel_resources["total_channels"]:
            issues_found += 1
            unmatched = channel_resources["total_channels"] - channel_resources["matched_count"]
            logger.warning(f"⚠️ {unmatched} SlackChannel records don't have corresponding ServiceResource records")

        if report_structure["valid_link_count"] < report_structure["total_analyses"]:
            issues_found += 1
            invalid_count = report_structure["total_analyses"] - report_structure["valid_link_count"]
            logger.warning(f"⚠️ {invalid_count} ResourceAnalysis records have invalid report links")

        if report_team_ids["null_team_id_count"] > 0:
            issues_found += 1
            logger.warning(f"⚠️ {report_team_ids['null_team_id_count']} reports have missing team_id values")

        if issues_found == 0:
            logger.info("✅ No issues found! The integration structure looks good.")
        else:
            logger.warning(f"⚠️ Found {issues_found} potential issues that might affect the unified analysis flow.")
            logger.info("It's recommended to fix these issues for optimal system performance.")

    except Exception as e:
        logger.error(f"Error running checks: {str(e)}", exc_info=True)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
