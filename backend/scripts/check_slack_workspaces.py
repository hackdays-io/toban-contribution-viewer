"""
Script to check the health and status of Slack workspaces in the system.

This script checks for various Slack workspace related issues, including:
1. Orphaned workspaces (not associated with an integration)
2. Workspaces with missing team_id values
3. Workspaces with inconsistent data (e.g., missing required fields)
4. Usage statistics for Slack workspaces (channels, messages, etc.)
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# We need to add the parent directory to the path to import the app modules
sys.path.insert(0, ".")

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.integration import (
    Integration,
    IntegrationType,
)
from app.models.slack import SlackChannel, SlackMessage, SlackWorkspace


async def check_workspace_counts(db: AsyncSession) -> Dict[str, int]:
    """
    Count SlackWorkspace records and report statistics.
    """
    logger.info("Checking SlackWorkspace counts...")

    # Count total workspaces
    stmt = select(func.count()).select_from(SlackWorkspace)
    result = await db.execute(stmt)
    total_workspaces = result.scalar_one_or_none() or 0

    # Count workspaces with null team_id
    stmt = (
        select(func.count())
        .select_from(SlackWorkspace)
        .where(SlackWorkspace.team_id.is_(None))
    )
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0

    # Count workspaces created in the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    stmt = (
        select(func.count())
        .select_from(SlackWorkspace)
        .where(SlackWorkspace.created_at >= thirty_days_ago)
    )
    result = await db.execute(stmt)
    recent_count = result.scalar_one_or_none() or 0

    # Count workspaces with associated integrations
    stmt = (
        select(func.count(SlackWorkspace.id))
        .distinct()
        .where(
            SlackWorkspace.slack_id.in_(
                select(
                    func.json_extract(Integration.integration_metadata, "$.slack_id")
                ).where(Integration.service_type == IntegrationType.SLACK)
            )
        )
    )
    result = await db.execute(stmt)
    with_integration_count = result.scalar_one_or_none() or 0

    # Count orphaned workspaces (no associated integration)
    orphaned_count = total_workspaces - with_integration_count

    results = {
        "total_workspaces": total_workspaces,
        "null_team_id_count": null_team_id_count,
        "recent_count": recent_count,
        "with_integration_count": with_integration_count,
        "orphaned_count": orphaned_count,
    }

    logger.info(f"SlackWorkspace counts: {json.dumps(results, indent=2)}")

    return results


async def check_workspace_usage(db: AsyncSession) -> Dict[str, Dict]:
    """
    Check usage statistics for each Slack workspace.
    """
    logger.info("Checking SlackWorkspace usage...")

    # Get all workspaces
    stmt = select(SlackWorkspace)
    result = await db.execute(stmt)
    workspaces = result.scalars().all()

    workspace_stats = {}

    for workspace in workspaces:
        # Count channels
        channel_stmt = (
            select(func.count())
            .select_from(SlackChannel)
            .where(SlackChannel.workspace_id == workspace.id)
        )
        result = await db.execute(channel_stmt)
        channel_count = result.scalar_one_or_none() or 0

        # Count selected channels
        selected_channel_stmt = (
            select(func.count())
            .select_from(SlackChannel)
            .where(
                SlackChannel.workspace_id == workspace.id,
                SlackChannel.is_selected_for_analysis.is_(True),
            )
        )
        result = await db.execute(selected_channel_stmt)
        selected_channel_count = result.scalar_one_or_none() or 0

        # Count messages
        message_stmt = (
            select(func.count())
            .select_from(SlackMessage)
            .where(
                SlackMessage.channel_id.in_(
                    select(SlackChannel.id).where(
                        SlackChannel.workspace_id == workspace.id
                    )
                )
            )
        )
        result = await db.execute(message_stmt)
        message_count = result.scalar_one_or_none() or 0

        # Calculate last message date
        last_message_stmt = (
            select(SlackMessage.message_datetime)
            .where(
                SlackMessage.channel_id.in_(
                    select(SlackChannel.id).where(
                        SlackChannel.workspace_id == workspace.id
                    )
                )
            )
            .order_by(desc(SlackMessage.message_datetime))
            .limit(1)
        )
        result = await db.execute(last_message_stmt)
        last_message_date = result.scalar_one_or_none()

        # Get integration details if available
        integration_stmt = select(Integration).where(
            Integration.service_type == IntegrationType.SLACK,
            Integration.integration_metadata.contains({"slack_id": workspace.slack_id}),
        )
        result = await db.execute(integration_stmt)
        integration = result.scalar_one_or_none()

        integration_id = None
        integration_name = None
        team_id = None

        if integration:
            integration_id = integration.id
            integration_name = integration.name
            team_id = integration.owner_team_id

        # Store statistics
        workspace_stats[str(workspace.id)] = {
            "name": workspace.name,
            "slack_id": workspace.slack_id,
            "channel_count": channel_count,
            "selected_channel_count": selected_channel_count,
            "message_count": message_count,
            "last_message_date": (
                last_message_date.isoformat() if last_message_date else None
            ),
            "integration_id": str(integration_id) if integration_id else None,
            "integration_name": integration_name,
            "team_id": str(team_id) if team_id else None,
            "created_at": (
                workspace.created_at.isoformat() if workspace.created_at else None
            ),
        }

    logger.info(f"Analyzed usage statistics for {len(workspaces)} workspaces")

    return workspace_stats


async def check_orphaned_workspaces(db: AsyncSession) -> List[Dict]:
    """
    Find orphaned workspaces (not associated with an integration).
    """
    logger.info("Checking for orphaned SlackWorkspaces...")

    # Get all workspaces
    stmt = select(SlackWorkspace)
    result = await db.execute(stmt)
    workspaces = result.scalars().all()

    # Get all Slack integrations' workspace IDs
    integration_stmt = select(
        func.json_extract(Integration.integration_metadata, "$.slack_id")
    ).where(Integration.service_type == IntegrationType.SLACK)
    result = await db.execute(integration_stmt)
    integration_slack_ids = [row[0] for row in result.fetchall() if row[0]]

    orphaned_workspaces = []

    for workspace in workspaces:
        if workspace.slack_id not in integration_slack_ids:
            # This workspace is not associated with any integration
            orphaned_workspaces.append(
                {
                    "id": str(workspace.id),
                    "name": workspace.name,
                    "slack_id": workspace.slack_id,
                    "created_at": (
                        workspace.created_at.isoformat()
                        if workspace.created_at
                        else None
                    ),
                    "team_id": str(workspace.team_id) if workspace.team_id else None,
                }
            )

    logger.info(f"Found {len(orphaned_workspaces)} orphaned workspaces")

    if orphaned_workspaces:
        logger.info("Orphaned workspaces:")
        for workspace in orphaned_workspaces:
            logger.info(f"  {workspace['name']} ({workspace['slack_id']})")

    return orphaned_workspaces


async def check_workspace_consistency(db: AsyncSession) -> List[Dict]:
    """
    Check for inconsistencies in SlackWorkspace records.
    """
    logger.info("Checking SlackWorkspace data consistency...")

    # Get all workspaces
    stmt = select(SlackWorkspace)
    result = await db.execute(stmt)
    workspaces = result.scalars().all()

    inconsistent_workspaces = []

    for workspace in workspaces:
        issues = []

        # Check for missing required fields
        if not workspace.name:
            issues.append("Missing name")

        if not workspace.slack_id:
            issues.append("Missing slack_id")

        if not workspace.team_id:
            issues.append("Missing team_id")

        # Check for related data consistency
        channel_stmt = (
            select(func.count())
            .select_from(SlackChannel)
            .where(SlackChannel.workspace_id == workspace.id)
        )
        result = await db.execute(channel_stmt)
        channel_count = result.scalar_one_or_none() or 0

        if channel_count == 0:
            issues.append("No associated channels")

        # Add to inconsistent workspaces list if issues found
        if issues:
            inconsistent_workspaces.append(
                {
                    "id": str(workspace.id),
                    "name": workspace.name,
                    "slack_id": workspace.slack_id,
                    "channel_count": channel_count,
                    "issues": issues,
                }
            )

    logger.info(
        f"Found {len(inconsistent_workspaces)} workspaces with consistency issues"
    )

    if inconsistent_workspaces:
        logger.info("Workspaces with consistency issues:")
        for workspace in inconsistent_workspaces:
            logger.info(
                f"  {workspace['name']} ({workspace['slack_id']}): {', '.join(workspace['issues'])}"
            )

    return inconsistent_workspaces


async def main():
    """
    Main function to run Slack workspace health checks.
    """
    logger.info("Starting Slack workspace health check")

    db = AsyncSessionLocal()

    try:
        # Run all checks
        counts = await check_workspace_counts(db)
        await check_orphaned_workspaces(db)
        inconsistent = await check_workspace_consistency(db)
        usage_stats = await check_workspace_usage(db)

        # Overall result summary
        logger.info("\n=== Slack Workspace Health Summary ===")

        issues_found = 0

        if counts["null_team_id_count"] > 0:
            issues_found += 1
            logger.warning(
                f"⚠️ {counts['null_team_id_count']} workspaces have missing team_id values"
            )

        if counts["orphaned_count"] > 0:
            issues_found += 1
            logger.warning(
                f"⚠️ {counts['orphaned_count']} workspaces are orphaned (not associated with an integration)"
            )

        if inconsistent:
            issues_found += 1
            logger.warning(
                f"⚠️ {len(inconsistent)} workspaces have data consistency issues"
            )

        if issues_found == 0:
            logger.info("✅ No issues found! All Slack workspaces appear healthy.")
        else:
            logger.warning(
                f"⚠️ Found {issues_found} potential issues with Slack workspaces."
            )
            logger.info(
                "It's recommended to fix these issues for optimal system performance."
            )

            if counts["null_team_id_count"] > 0:
                logger.info(
                    "To fix missing team_id values, run the check_slack_mapping.py script."
                )

        # Print workspace usage statistics
        logger.info("\n=== Workspace Usage Statistics ===")

        for workspace_id, stats in usage_stats.items():
            logger.info(f"Workspace: {stats['name']} ({stats['slack_id']})")
            logger.info(
                f"  Channels: {stats['channel_count']} (Selected: {stats['selected_channel_count']})"
            )
            logger.info(f"  Messages: {stats['message_count']}")
            logger.info(f"  Last message: {stats['last_message_date'] or 'None'}")
            logger.info(
                f"  Integration: {stats['integration_name'] or 'None'} ({stats['integration_id'] or 'None'})"
            )
            logger.info(f"  Team ID: {stats['team_id'] or 'None'}")

    except Exception as e:
        logger.error(f"Error running workspace health check: {str(e)}", exc_info=True)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
