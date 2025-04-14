"""
Service layer for team member operations.
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team, TeamMember, TeamMemberRole
from app.services.team.permissions import ensure_team_permission, get_team_member

logger = logging.getLogger(__name__)


class TeamMemberService:
    """Service for team member operations."""

    @staticmethod
    async def get_team_members(
        db: AsyncSession, team_id: UUID, user_id: str
    ) -> List[TeamMember]:
        """
        Get all members of a team.

        Args:
            db: Database session
            team_id: Team ID to get members for
            user_id: User ID making the request (for permission check)

        Returns:
            List of team members

        Raises:
            HTTPException: If team doesn't exist or user doesn't have permission
        """
        logger.info(f"Getting members for team {team_id}")

        # Check if the team exists
        team_query = select(Team).where(Team.id == team_id, Team.is_active.is_(True))
        team_result = await db.execute(team_query)
        team = team_result.scalars().first()

        if not team:
            logger.warning(f"Team with ID {team_id} not found during member lookup")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
            )

        # Check if the user is a member of the team (any role can view members)
        await ensure_team_permission(
            db,
            team_id,
            user_id,
            [
                TeamMemberRole.OWNER,
                TeamMemberRole.ADMIN,
                TeamMemberRole.MEMBER,
                TeamMemberRole.VIEWER,
            ],
        )

        # Get all active team members (note: using invitation_status instead of is_active)
        query = (
            select(TeamMember)
            .where(
                TeamMember.team_id == team_id, TeamMember.invitation_status == "active"
            )
            .order_by(TeamMember.role, TeamMember.created_at)
        )

        result = await db.execute(query)
        members = result.scalars().all()

        logger.info(f"Found {len(members)} members for team {team_id}")
        return members

    @staticmethod
    async def get_team_member_by_id(
        db: AsyncSession, team_id: UUID, member_id: UUID, user_id: str
    ) -> Optional[TeamMember]:
        """
        Get a specific team member by ID.

        Args:
            db: Database session
            team_id: Team ID
            member_id: Member ID to look up
            user_id: User ID making the request (for permission check)

        Returns:
            TeamMember object if found, None otherwise

        Raises:
            HTTPException: If team or member doesn't exist or user doesn't have permission
        """
        logger.info(f"Getting team member {member_id} for team {team_id}")

        # Check if the user is a member of the team (any role can view members)
        await ensure_team_permission(
            db,
            team_id,
            user_id,
            [
                TeamMemberRole.OWNER,
                TeamMemberRole.ADMIN,
                TeamMemberRole.MEMBER,
                TeamMemberRole.VIEWER,
            ],
        )

        # Get the specific team member
        query = select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.id == member_id,
            TeamMember.invitation_status == "active",
        )

        result = await db.execute(query)
        member = result.scalars().first()

        if not member:
            logger.warning(f"Member {member_id} in team {team_id} not found")

        return member

    @staticmethod
    async def add_team_member(
        db: AsyncSession, team_id: UUID, member_data: Dict, user_id: str
    ) -> TeamMember:
        """
        Add a new member to a team.

        Args:
            db: Database session
            team_id: Team ID to add member to
            member_data: Member data for creation
            user_id: User ID making the request (for permission check)

        Returns:
            Newly created team member

        Raises:
            HTTPException: If team doesn't exist, user lacks permission, or other error occurs
        """
        logger.info(f"Adding new member to team {team_id}: {member_data}")

        # Check permissions (must be owner or admin to add members)
        await ensure_team_permission(
            db, team_id, user_id, [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
        )

        # Check if the user is already a member
        existing_member = await get_team_member(db, team_id, member_data.get("user_id"))
        if existing_member and existing_member.invitation_status == "active":
            logger.warning(
                f"User {member_data.get('user_id')} is already a member of team {team_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this team",
            )

        try:
            # Verify the role is valid
            role = member_data.get("role")
            if role not in [r.value for r in TeamMemberRole]:
                logger.error(f"Invalid role: {role}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role: {role}. Valid roles are: {[r.value for r in TeamMemberRole]}",
                )

            # Create the team member
            team_member = TeamMember(
                team_id=team_id,
                user_id=member_data.get("user_id"),
                email=member_data.get("email"),
                display_name=member_data.get("display_name"),
                role=role,
                invitation_status=member_data.get("invitation_status", "active"),
            )

            # If invitation is pending, generate a token and set expiry
            if team_member.invitation_status == "pending":
                token = "".join(
                    secrets.choice(string.ascii_letters + string.digits)
                    for _ in range(32)
                )
                team_member.invitation_token = token
                team_member.invitation_expires_at = datetime.utcnow() + timedelta(
                    days=7
                )

            db.add(team_member)
            await db.commit()
            await db.refresh(team_member)

            # Update team_size counter
            await TeamMemberService.update_team_size(db, team_id)

            logger.info(f"Added team member {team_member.id} to team {team_id}")
            return team_member

        except IntegrityError as e:
            logger.error(f"Integrity error adding team member: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error adding team member - data might be invalid",
            )
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            logger.error(f"Error adding team member: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while adding the team member",
            )

    @staticmethod
    async def update_team_member(
        db: AsyncSession,
        team_id: UUID,
        member_id: UUID,
        member_data: Dict,
        user_id: str,
    ) -> TeamMember:
        """
        Update an existing team member.

        Args:
            db: Database session
            team_id: Team ID
            member_id: ID of the member to update
            member_data: Updated member data
            user_id: User ID making the request (for permission check)

        Returns:
            Updated team member

        Raises:
            HTTPException: If team or member doesn't exist, user lacks permission, or other error
        """
        logger.info(f"Updating team member {member_id} in team {team_id}")

        # Get the member to update
        member = await TeamMemberService.get_team_member_by_id(
            db, team_id, member_id, user_id
        )
        if not member:
            logger.warning(f"Member {member_id} not found during update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found"
            )

        # Owners can update any member; admins can update members and viewers but not owners or other admins
        requester_member = await get_team_member(db, team_id, user_id)
        if not requester_member:
            logger.warning(f"Requester {user_id} is not a member of team {team_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this team member",
            )

        # Permission logic
        if requester_member.role != TeamMemberRole.OWNER:
            # Admins can't modify owners or other admins
            if requester_member.role == TeamMemberRole.ADMIN and (
                member.role == TeamMemberRole.OWNER
                or member.role == TeamMemberRole.ADMIN
                or member_data.get("role")
                in [TeamMemberRole.OWNER.value, TeamMemberRole.ADMIN.value]
            ):
                logger.warning(
                    f"Admin {user_id} tried to update owner/admin {member_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins cannot modify owners or other admins",
                )

            # Regular members and viewers can't update other members
            if requester_member.role in [TeamMemberRole.MEMBER, TeamMemberRole.VIEWER]:
                # Members can only update themselves and only certain fields
                if member.user_id != user_id:
                    logger.warning(
                        f"Member {user_id} tried to update another member {member_id}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only update your own profile",
                    )

                # Regular members can only update their display name
                allowed_fields = ["display_name"]
                for field in member_data:
                    if field not in allowed_fields:
                        logger.warning(
                            f"Member {user_id} tried to update restricted field: {field}"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"You can only update these fields: {allowed_fields}",
                        )

        try:
            # Update allowed fields
            if "role" in member_data and member_data["role"] in [
                r.value for r in TeamMemberRole
            ]:
                member.role = member_data["role"]

            if "display_name" in member_data:
                member.display_name = member_data["display_name"]

            if "invitation_status" in member_data:
                member.invitation_status = member_data["invitation_status"]

                # If changing to active from pending, clear invitation data
                if (
                    member_data["invitation_status"] == "active"
                    and member.invitation_token
                ):
                    member.invitation_token = None
                    member.invitation_expires_at = None

                # If changing to pending from something else, generate invitation data
                elif (
                    member_data["invitation_status"] == "pending"
                    and not member.invitation_token
                ):
                    token = "".join(
                        secrets.choice(string.ascii_letters + string.digits)
                        for _ in range(32)
                    )
                    member.invitation_token = token
                    member.invitation_expires_at = datetime.utcnow() + timedelta(days=7)

            # Save changes
            await db.commit()
            await db.refresh(member)

            logger.info(f"Updated team member {member_id} successfully")
            return member

        except Exception as e:
            logger.error(f"Error updating team member: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while updating the team member",
            )

    @staticmethod
    async def remove_team_member(
        db: AsyncSession, team_id: UUID, member_id: UUID, user_id: str
    ) -> Dict:
        """
        Remove (deactivate) a team member.

        Args:
            db: Database session
            team_id: Team ID
            member_id: ID of the member to remove
            user_id: User ID making the request (for permission check)

        Returns:
            Dict with status information

        Raises:
            HTTPException: If team or member doesn't exist, user lacks permission, or other error
        """
        logger.info(f"Removing team member {member_id} from team {team_id}")

        # Get the member to remove
        member = await TeamMemberService.get_team_member_by_id(
            db, team_id, member_id, user_id
        )
        if not member:
            logger.warning(f"Member {member_id} not found during removal")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found"
            )

        # Get the requester's role
        requester_member = await get_team_member(db, team_id, user_id)
        if not requester_member:
            logger.warning(f"Requester {user_id} is not a member of team {team_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to remove this team member",
            )

        # Permission logic
        if requester_member.role != TeamMemberRole.OWNER:
            # Admins can't remove owners or other admins
            if requester_member.role == TeamMemberRole.ADMIN and (
                member.role == TeamMemberRole.OWNER
                or member.role == TeamMemberRole.ADMIN
            ):
                logger.warning(
                    f"Admin {user_id} tried to remove owner/admin {member_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins cannot remove owners or other admins",
                )

            # Regular members and viewers can only remove themselves (leave team)
            if requester_member.role in [TeamMemberRole.MEMBER, TeamMemberRole.VIEWER]:
                if member.user_id != user_id:
                    logger.warning(
                        f"Member {user_id} tried to remove another member {member_id}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only remove yourself from the team",
                    )

        # Prevent removing the last owner
        if member.role == TeamMemberRole.OWNER:
            # Count how many active owners the team has
            owner_count_query = (
                select(func.count())
                .select_from(TeamMember)
                .where(
                    TeamMember.team_id == team_id,
                    TeamMember.role == TeamMemberRole.OWNER,
                    TeamMember.invitation_status == "active",
                )
            )

            result = await db.execute(owner_count_query)
            owner_count = result.scalar_one()

            if owner_count <= 1:
                logger.warning(
                    f"Attempted to remove the last owner from team {team_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner of the team",
                )

        try:
            # Soft delete - update invitation_status
            member.invitation_status = "inactive"

            # Save changes
            await db.commit()

            # Update team_size counter
            await TeamMemberService.update_team_size(db, team_id)

            # User removing themselves (leaving) vs admin/owner removing someone
            message = (
                "You have left the team"
                if member.user_id == user_id
                else "Member has been removed from the team"
            )

            logger.info(f"Removed team member {member_id} from team {team_id}")
            return {"status": "success", "message": message}

        except Exception as e:
            logger.error(f"Error removing team member: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while removing the team member",
            )

    @staticmethod
    async def update_team_size(db: AsyncSession, team_id: UUID) -> None:
        """
        Update the team_size counter in the Team table.

        Args:
            db: Database session
            team_id: Team ID to update size for
        """
        try:
            # Count active members
            count_query = (
                select(func.count())
                .select_from(TeamMember)
                .where(
                    TeamMember.team_id == team_id,
                    TeamMember.invitation_status == "active",
                )
            )

            result = await db.execute(count_query)
            member_count = result.scalar_one()

            # Update the team size
            await db.execute(
                update(Team).where(Team.id == team_id).values(team_size=member_count)
            )

            await db.commit()
            logger.info(f"Updated team {team_id} size to {member_count}")

        except Exception as e:
            logger.error(f"Error updating team size for team {team_id}: {str(e)}")
            await db.rollback()
            # Don't raise an exception as this is a background operation
