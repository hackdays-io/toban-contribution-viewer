#!/usr/bin/env python3
"""
Script to create default teams for existing Slack workspaces.

For each Slack workspace without a team, creates a personal team for the workspace
and associates the workspace with it. This ensures backward compatibility when
introducing the team concept.

Usage:
    python -m scripts.create_default_teams
"""

import logging
import sys
import uuid
from typing import Dict, List

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.slack import SlackWorkspace
from app.models.team import Team

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def create_default_teams(session: Session, dry_run: bool = False) -> Dict[str, int]:
    """
    Create default teams for each Slack workspace without a team.

    Args:
        session: SQLAlchemy session
        dry_run: If True, don't commit changes to the database

    Returns:
        Dict with counts of workspaces processed and teams created
    """
    # Get all workspaces without teams
    workspaces_without_teams: List[SlackWorkspace] = (
        session.query(SlackWorkspace).filter(SlackWorkspace.team_id.is_(None)).all()
    )

    logger.info(f"Found {len(workspaces_without_teams)} workspaces without teams")

    if not workspaces_without_teams:
        return {"workspaces_processed": 0, "teams_created": 0}

    teams_created = 0
    workspaces_processed = 0

    for workspace in workspaces_without_teams:
        # Create a personal team for this workspace
        team_name = f"{workspace.name} Team"
        team_slug = f"{workspace.name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}"

        logger.info(f"Creating team '{team_name}' for workspace '{workspace.name}'")

        team = Team(
            name=team_name,
            slug=team_slug,
            description=f"Default team for {workspace.name} Slack workspace",
            is_personal=True,
            created_by_user_id="system",  # This will be replaced with actual user ID in production
            team_metadata={"auto_created": True, "source": "data_migration"},
        )

        if not dry_run:
            session.add(team)
            # Flush to get the team ID
            session.flush()

            # Associate the workspace with the new team
            workspace.team_id = team.id

            # Create a default team member (optional)
            # This would be populated in production with actual data
            # member = TeamMember(
            #     team_id=team.id,
            #     user_id="system",
            #     role=TeamMemberRole.OWNER,
            #     invitation_status="active",
            # )
            # session.add(member)

            teams_created += 1

        workspaces_processed += 1

    if not dry_run and workspaces_processed > 0:
        session.commit()
        logger.info(f"Committed changes: {teams_created} teams created for {workspaces_processed} workspaces")
    else:
        logger.info(f"Dry run: would create {teams_created} teams for {workspaces_processed} workspaces")

    return {
        "workspaces_processed": workspaces_processed,
        "teams_created": teams_created,
    }


def create_test_user_team(session: Session, user_id: str, email: str = None):
    """
    Create a test team for a specific user.

    Args:
        session: SQLAlchemy session
        user_id: User ID to create team for
        email: Optional email of the user

    Returns:
        Created team
    """
    from app.models.team import Team, TeamMember, TeamMemberRole

    logger.info(f"Creating test team for user {user_id}")

    # Create the team
    team = Team(
        name="My Test Team",
        slug=f"my-test-team-{uuid.uuid4().hex[:8]}",
        description="A test team created for development",
        is_personal=True,
        created_by_user_id=user_id,
        created_by_email=email,
        team_metadata={"auto_created": True, "source": "test_script"},
    )

    session.add(team)
    # Flush to get the team ID
    session.flush()

    # Create the team member (owner)
    member = TeamMember(
        team_id=team.id,
        user_id=user_id,
        email=email,
        role=TeamMemberRole.OWNER,
        invitation_status="active",
    )
    session.add(member)

    session.commit()

    logger.info(f"Created test team '{team.name}' (ID: {team.id}) for user {user_id}")
    return team


def main():
    """Run the script."""
    logger.info("Starting data migration: creating default teams for workspaces")

    # Parse command line arguments
    dry_run = "--dry-run" in sys.argv
    create_test_team = "--create-test-team" in sys.argv

    # Get custom user ID if specified
    user_id_arg = None
    user_email_arg = None
    for arg in sys.argv:
        if arg.startswith("--user-id="):
            user_id_arg = arg.split("=")[1]
        if arg.startswith("--email="):
            user_email_arg = arg.split("=")[1]

    if dry_run:
        logger.info("Running in dry-run mode, no changes will be committed")

    # Use the existing SQLAlchemy session
    session = SessionLocal()
    try:
        if create_test_team:
            # Create a test team for development
            test_user_id = user_id_arg or "auth0|user1234"
            test_email = user_email_arg or "test@example.com"

            logger.info(f"Creating test team for user ID: {test_user_id}, email: {test_email}")
            create_test_user_team(session, test_user_id, test_email)
            logger.info(f"Test team created for user {test_user_id}")
        else:
            results = create_default_teams(session, dry_run=dry_run)
            logger.info(
                f"Data migration complete: processed {results['workspaces_processed']} "
                f"workspaces, created {results['teams_created']} teams"
            )
    except Exception as e:
        logger.error(f"Error during data migration: {e}")
        if not dry_run:
            logger.info("Rolling back changes")
            session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
