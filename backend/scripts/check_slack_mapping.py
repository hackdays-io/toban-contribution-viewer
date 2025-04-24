"""
Script to check the Slack workspace mapping and team association.

This script validates the relationship between Slack workspaces and teams,
and proposes fixes for workspaces with missing team_id values.
"""

import asyncio
import logging
import sys
from typing import Dict, List, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# We need to add the parent directory to the path to import the app modules
sys.path.insert(0, ".")

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.integration import Integration, IntegrationType
from app.models.slack import SlackWorkspace
from app.models.team import Team


async def check_workspace_team_mapping(db: AsyncSession) -> Tuple[int, int]:
    """
    Check SlackWorkspace records for missing team_id values.

    Returns:
        Tuple of (total_workspaces, null_team_id_count)
    """
    logger.info("Checking SlackWorkspace team_id assignments...")

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

    # Calculate percentage
    percentage = 0
    if total_workspaces > 0:
        percentage = (null_team_id_count / total_workspaces) * 100

    logger.info(
        f"Found {total_workspaces} workspaces, {null_team_id_count} ({percentage:.1f}%) missing team_id"
    )

    return (total_workspaces, null_team_id_count)


async def find_workspace_teams(db: AsyncSession) -> List[Dict]:
    """
    Find potential team associations for workspaces with missing team_id.

    Returns:
        List of dictionaries with workspace and potential team info
    """
    logger.info(
        "Finding potential team associations for workspaces with missing team_id..."
    )

    # Get all workspaces with null team_id
    stmt = select(SlackWorkspace).where(SlackWorkspace.team_id.is_(None))
    result = await db.execute(stmt)
    workspaces = result.scalars().all()

    workspace_teams = []

    for workspace in workspaces:
        # Try to find an integration associated with this workspace
        # Look for a Slack integration with this workspace's slack_id in its metadata
        stmt = select(Integration).where(
            Integration.service_type == IntegrationType.SLACK,
            Integration.integration_metadata.contains({"slack_id": workspace.slack_id}),
        )
        result = await db.execute(stmt)
        integration = result.scalar_one_or_none()

        team_id = None
        team_name = None
        integration_id = None

        if integration:
            integration_id = integration.id
            if integration.owner_team_id:
                team_id = integration.owner_team_id

                # Get the team name
                team_stmt = select(Team).where(Team.id == team_id)
                team_result = await db.execute(team_stmt)
                team = team_result.scalar_one_or_none()
                if team:
                    team_name = team.name

        workspace_teams.append(
            {
                "workspace_id": workspace.id,
                "workspace_name": workspace.name,
                "slack_id": workspace.slack_id,
                "team_id": team_id,
                "team_name": team_name,
                "integration_id": integration_id,
                "can_fix": team_id is not None,
            }
        )

    return workspace_teams


async def fix_workspace_team_mapping(
    db: AsyncSession, dry_run: bool = True
) -> Tuple[int, int]:
    """
    Fix SlackWorkspace records with missing team_id values.

    Args:
        db: Database session
        dry_run: If True, only print what would be done without making changes

    Returns:
        Tuple of (total_fixed, total_failed)
    """
    workspace_teams = await find_workspace_teams(db)

    total_fixed = 0
    total_failed = 0

    for workspace in workspace_teams:
        if workspace["can_fix"]:
            logger.info(
                f"{'Would fix' if dry_run else 'Fixing'} workspace {workspace['workspace_name']} ({workspace['workspace_id']}):"
            )
            logger.info(
                f"  Setting team_id to {workspace['team_id']} ({workspace['team_name']})"
            )

            if not dry_run:
                try:
                    stmt = (
                        update(SlackWorkspace)
                        .where(SlackWorkspace.id == workspace["workspace_id"])
                        .values(team_id=workspace["team_id"])
                    )
                    await db.execute(stmt)
                    await db.commit()
                    logger.info(
                        f"  ✅ Successfully updated workspace {workspace['workspace_id']}"
                    )
                    total_fixed += 1
                except Exception as e:
                    logger.error(
                        f"  ❌ Failed to update workspace {workspace['workspace_id']}: {str(e)}"
                    )
                    await db.rollback()
                    total_failed += 1
            else:
                total_fixed += 1
        else:
            logger.warning(
                f"Cannot fix workspace {workspace['workspace_name']} ({workspace['workspace_id']}): No team association found"
            )
            total_failed += 1

    return (total_fixed, total_failed)


async def main(auto_fix: bool = False):
    """
    Main function to run workspace team mapping checks and fixes.

    Args:
        auto_fix: If True, automatically apply fixes without prompting
    """
    logger.info("Starting Slack workspace team mapping validation")

    db = AsyncSessionLocal()

    try:
        # Check current mapping status
        total_workspaces, null_team_id_count = await check_workspace_team_mapping(db)

        if null_team_id_count == 0:
            logger.info(
                "✅ No workspaces with missing team_id found. All workspaces are properly mapped!"
            )
            return

        # Try to find team associations for workspaces with missing team_id
        workspace_teams = await find_workspace_teams(db)

        # Print workspace team association info
        logger.info("Workspace team associations:")
        fixable_count = 0
        unfixable_count = 0

        for workspace in workspace_teams:
            if workspace["can_fix"]:
                logger.info(
                    f"✅ Workspace: {workspace['workspace_name']} ({workspace['workspace_id']})"
                )
                logger.info(
                    f"  Team: {workspace['team_name']} ({workspace['team_id']})"
                )
                logger.info(f"  Integration: {workspace['integration_id']}")
                fixable_count += 1
            else:
                logger.warning(
                    f"❌ Workspace: {workspace['workspace_name']} ({workspace['workspace_id']}) - No team association found"
                )
                unfixable_count += 1

        logger.info(
            f"Summary: {fixable_count} workspaces can be fixed, {unfixable_count} cannot be automatically fixed"
        )

        # Determine if we should fix the workspace team mapping
        should_fix = auto_fix

        if fixable_count > 0 and not auto_fix:
            try:
                fix_option = (
                    input("\nWould you like to fix the workspace team mapping? (y/n): ")
                    .strip()
                    .lower()
                )
                should_fix = fix_option == "y"
            except (EOFError, KeyboardInterrupt):
                logger.info(
                    "No input available or interrupted, running in dry run mode"
                )
                should_fix = False

        if fixable_count > 0:
            if should_fix:
                # Fix workspace team mapping
                logger.info("Applying fixes to workspace team mapping...")
                total_fixed, total_failed = await fix_workspace_team_mapping(
                    db, dry_run=False
                )
                logger.info(
                    f"Fix summary: {total_fixed} workspaces fixed, {total_failed} workspaces failed to fix"
                )

                # Check mapping status after fix
                total_workspaces, null_team_id_count = (
                    await check_workspace_team_mapping(db)
                )

                if null_team_id_count == 0:
                    logger.info("✅ All workspaces now have team_id values!")
                else:
                    logger.warning(
                        f"⚠️ {null_team_id_count} workspaces still have missing team_id values"
                    )
            else:
                # Show what would be fixed in dry run mode
                logger.info("Running in dry run mode (no changes will be made):")
                total_fixed, total_failed = await fix_workspace_team_mapping(
                    db, dry_run=True
                )
                logger.info(
                    f"Dry run summary: {total_fixed} workspaces would be fixed, {total_failed} workspaces could not be fixed"
                )

    except Exception as e:
        logger.error(
            f"Error running workspace team mapping validation: {str(e)}", exc_info=True
        )
    finally:
        await db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Check and fix Slack workspace team mapping"
    )
    parser.add_argument(
        "--auto-fix",
        action="store_true",
        help="Automatically fix workspace team mapping without prompting",
    )
    args = parser.parse_args()

    try:
        asyncio.run(main(auto_fix=args.auto_fix))
    except KeyboardInterrupt:
        logger.info("\nOperation cancelled by user")
        sys.exit(0)
