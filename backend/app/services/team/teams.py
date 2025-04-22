"""
Service layer for team operations.
"""

import logging
import uuid
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.team import Team, TeamMember, TeamMemberRole
from app.services.team.permissions import ensure_team_permission

logger = logging.getLogger(__name__)


class TeamService:
    """Service for team-related operations."""

    @staticmethod
    async def get_teams_for_user(
        db: AsyncSession,
        user_id: str,
        include_members: bool = False,
        auto_create: bool = True,
    ) -> List[Team]:
        """
        Get all teams that a user is a member of.

        Args:
            db: Database session
            user_id: User ID to get teams for
            include_members: Whether to include team members in the response
            auto_create: Whether to auto-create a personal team if user has none

        Returns:
            List of teams the user is a member of
        """
        logger.info(f"Getting teams for user {user_id}")

        # Build the query
        query = (
            select(Team)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(TeamMember.user_id == user_id, Team.is_active.is_(True))
        )

        # Include team members if requested
        if include_members:
            query = query.options(selectinload(Team.members))

        result = await db.execute(query)
        teams = result.scalars().all()

        logger.info(f"Found {len(teams)} teams for user {user_id}")

        # Auto-create a team if user has none and auto_create is enabled
        if not teams and auto_create:
            logger.info(
                f"No teams found for user {user_id}, auto-creating a personal team"
            )
            try:
                # Create a personal team for this user
                team_name = "My Personal Team"
                team_slug = f"personal-team-{uuid.uuid4().hex[:8]}"

                team = Team(
                    name=team_name,
                    slug=team_slug,
                    description="Your default team for managing workspaces",
                    is_personal=True,
                    created_by_user_id=user_id,
                    team_metadata={"auto_created": True},
                )

                db.add(team)
                await db.flush()  # Flush to get the team ID

                # Add the user as an owner
                team_member = TeamMember(
                    team_id=team.id,
                    user_id=user_id,
                    role=TeamMemberRole.OWNER,
                    invitation_status="active",
                )

                db.add(team_member)
                await db.commit()
                
                # Explicitly load the team with its members to avoid lazy loading issues
                query = select(Team).where(Team.id == team.id).options(selectinload(Team.members))
                result = await db.execute(query)
                team = result.scalars().first()

                logger.info(
                    f"Auto-created team '{team.name}' (ID: {team.id}) for user {user_id}"
                )

                # Return the newly created team
                return [team]
            except Exception as e:
                logger.error(f"Error auto-creating team for user {user_id}: {str(e)}")
                await db.rollback()
                # Continue with empty teams list

        return teams

    @staticmethod
    async def get_team_by_id(
        db: AsyncSession, team_id: UUID, include_members: bool = False
    ) -> Optional[Team]:
        """
        Get a team by its ID.

        Args:
            db: Database session
            team_id: Team ID to look up
            include_members: Whether to include team members in the response

        Returns:
            Team object if found, None otherwise
        """
        logger.info(f"Getting team with ID {team_id}")

        # Build the query
        query = select(Team).where(Team.id == team_id, Team.is_active.is_(True))

        # Include team members if requested
        if include_members:
            query = query.options(selectinload(Team.members))

        result = await db.execute(query)
        team = result.scalars().first()

        if not team:
            logger.warning(f"Team with ID {team_id} not found")

        return team

    @staticmethod
    async def get_team_by_slug(
        db: AsyncSession, slug: str, include_members: bool = False
    ) -> Optional[Team]:
        """
        Get a team by its slug.

        Args:
            db: Database session
            slug: Team slug to look up
            include_members: Whether to include team members in the response

        Returns:
            Team object if found, None otherwise
        """
        logger.info(f"Getting team with slug {slug}")

        # Build the query
        query = select(Team).where(Team.slug == slug, Team.is_active.is_(True))

        # Include team members if requested
        if include_members:
            query = query.options(selectinload(Team.members))

        result = await db.execute(query)
        team = result.scalars().first()

        if not team:
            logger.warning(f"Team with slug {slug} not found")

        return team

    @staticmethod
    async def create_team(
        db: AsyncSession,
        team_data: Dict,
        user_id: str,
        user_email: Optional[str] = None,
    ) -> Team:
        """
        Create a new team.

        Args:
            db: Database session
            team_data: Team data for creation
            user_id: ID of the user creating the team
            user_email: Email of the user creating the team

        Returns:
            Newly created team

        Raises:
            HTTPException: If team creation fails
        """
        logger.info(f"Creating new team '{team_data.get('name')}' for user {user_id}")

        # Check if slug already exists
        existing_team = await TeamService.get_team_by_slug(db, team_data.get("slug"))
        if existing_team:
            logger.warning(f"Team with slug {team_data.get('slug')} already exists")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Team with slug '{team_data.get('slug')}' already exists",
            )

        try:
            # Create the team
            team = Team(
                name=team_data.get("name"),
                slug=team_data.get("slug"),
                description=team_data.get("description"),
                avatar_url=team_data.get("avatar_url"),
                is_personal=team_data.get("is_personal", False),
                team_metadata=team_data.get("team_metadata"),
                created_by_user_id=user_id,
                created_by_email=user_email,
            )

            db.add(team)
            await db.flush()  # Flush to get the team ID

            # Add the creator as an owner
            team_member = TeamMember(
                team_id=team.id,
                user_id=user_id,
                email=user_email,
                role=TeamMemberRole.OWNER,
                invitation_status="active",
            )

            db.add(team_member)
            await db.commit()
            
            # Explicitly load the team with its members to avoid lazy loading issues
            query = select(Team).where(Team.id == team.id).options(selectinload(Team.members))
            result = await db.execute(query)
            team_with_members = result.scalars().first()

            logger.info(
                f"Created team '{team.name}' (ID: {team.id}) for user {user_id}"
            )
            return team_with_members

        except IntegrityError as e:
            logger.error(f"Integrity error creating team: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error creating team - slug may be taken or data invalid",
            )
        except Exception as e:
            logger.error(f"Error creating team: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while creating the team",
            )

    @staticmethod
    async def update_team(
        db: AsyncSession, team_id: UUID, team_data: Dict, user_id: str
    ) -> Team:
        """
        Update an existing team.

        Args:
            db: Database session
            team_id: ID of the team to update
            team_data: Updated team data
            user_id: ID of the user making the update request

        Returns:
            Updated team

        Raises:
            HTTPException: If team doesn't exist or user doesn't have permission
        """
        logger.info(f"Updating team {team_id} with data: {team_data}")

        # Get the team and verify permissions
        team = await TeamService.get_team_by_id(db, team_id)
        if not team:
            logger.warning(f"Team with ID {team_id} not found during update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
            )

        # Check permissions (user must be owner or admin)
        await ensure_team_permission(
            db, team_id, user_id, [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
        )

        # Check if slug is being changed and if the new slug exists
        if team_data.get("slug") and team_data["slug"] != team.slug:
            existing_team = await TeamService.get_team_by_slug(db, team_data["slug"])
            if existing_team:
                logger.warning(f"Team with slug {team_data['slug']} already exists")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Team with slug '{team_data['slug']}' already exists",
                )

        try:
            # Update team fields
            if team_data.get("name"):
                team.name = team_data["name"]

            if team_data.get("slug"):
                team.slug = team_data["slug"]

            if "description" in team_data:
                team.description = team_data["description"]

            if "avatar_url" in team_data:
                team.avatar_url = team_data["avatar_url"]

            if "team_metadata" in team_data:
                team.team_metadata = team_data["team_metadata"]

            # Save changes
            await db.commit()
            await db.refresh(team)

            logger.info(f"Updated team {team_id} successfully")
            return team

        except IntegrityError as e:
            logger.error(f"Integrity error updating team: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error updating team - slug may be taken or data invalid",
            )
        except Exception as e:
            logger.error(f"Error updating team: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while updating the team",
            )

    @staticmethod
    async def delete_team(db: AsyncSession, team_id: UUID, user_id: str) -> Dict:
        """
        Delete (deactivate) a team.

        Args:
            db: Database session
            team_id: ID of the team to delete
            user_id: ID of the user making the delete request

        Returns:
            Dict with status information

        Raises:
            HTTPException: If team doesn't exist or user doesn't have permission
        """
        logger.info(f"Deleting team {team_id} by user {user_id}")

        # Get the team and verify permissions
        team = await TeamService.get_team_by_id(db, team_id)
        if not team:
            logger.warning(f"Team with ID {team_id} not found during delete")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
            )

        # Check permissions (only owner can delete)
        await ensure_team_permission(db, team_id, user_id, [TeamMemberRole.OWNER])

        try:
            # Soft delete - update is_active flag
            team.is_active = False

            # Save changes
            await db.commit()

            logger.info(f"Deleted team {team_id} successfully")
            return {
                "status": "success",
                "message": f"Team '{team.name}' has been deleted",
            }

        except Exception as e:
            logger.error(f"Error deleting team: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while deleting the team",
            )

    @staticmethod
    async def generate_unique_slug(db: AsyncSession, base_slug: str) -> str:
        """
        Generate a unique slug for a team based on a base slug.

        Args:
            db: Database session
            base_slug: Base string to create slug from

        Returns:
            A unique slug that doesn't exist in the database
        """
        # Convert to lowercase and replace spaces with hyphens
        slug = base_slug.lower().replace(" ", "-")

        # Check if the basic slug is available
        team = await TeamService.get_team_by_slug(db, slug)
        if not team:
            return slug

        # If not, add a unique identifier
        unique_id = str(uuid.uuid4())[:8]  # Use first 8 chars of UUID
        return f"{slug}-{unique_id}"
