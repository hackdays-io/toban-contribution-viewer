"""
Permissions and access control for teams.
"""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import TeamMember, TeamMemberRole

logger = logging.getLogger(__name__)


async def get_team_member(
    db: AsyncSession, team_id: UUID, user_id: str, include_all_statuses: bool = False
) -> Optional[TeamMember]:
    """
    Get a user's membership status in a team.

    Args:
        db: Database session
        team_id: Team ID
        user_id: User ID to check
        include_all_statuses: If True, include members with any invitation status,
                              otherwise only active members

    Returns:
        TeamMember object if user is a member, None otherwise
    """
    if include_all_statuses:
        # Return membership with any status
        query = select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    else:
        # Only return active members
        query = select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
            TeamMember.invitation_status == "active",
        )

    result = await db.execute(query)
    return result.scalars().first()


async def ensure_team_permission(
    db: AsyncSession, team_id: UUID, user_id: str, allowed_roles: List[TeamMemberRole]
) -> TeamMember:
    """
    Ensure a user has a particular role or higher in a team.

    Args:
        db: Database session
        team_id: Team ID
        user_id: User ID to check
        allowed_roles: List of roles that are allowed to perform the action

    Returns:
        TeamMember object if user has permission

    Raises:
        HTTPException: If user doesn't have required permissions
    """
    logger.info(f"Checking if user {user_id} has role {allowed_roles} in team {team_id}")

    # Get the user's team membership - only active members can access team resources
    member = await get_team_member(db, team_id, user_id, include_all_statuses=False)

    if not member:
        logger.warning(f"User {user_id} is not an active member of team {team_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this team",
        )

    # Check if the user's role is in the allowed roles
    if member.role not in allowed_roles:
        logger.warning(f"User {user_id} with role {member.role} tried to perform action requiring {allowed_roles}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have the required permissions for this action",
        )

    return member


async def require_team_access(
    db: AsyncSession,
    team_id: UUID,
    user_id: str,
) -> TeamMember:
    """
    Require that a user has any level of access to a team.

    Args:
        db: Database session
        team_id: Team ID
        user_id: User ID to check

    Returns:
        TeamMember object if user has any access

    Raises:
        HTTPException: If user doesn't have access
    """
    # Allow any role
    return await ensure_team_permission(
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


async def has_team_permission(
    db: AsyncSession,
    team_id: UUID,
    user_id: str,
    permission_level: str,
) -> bool:
    """
    Check if a user has a particular permission level in a team without raising exceptions.

    Args:
        db: Database session
        team_id: Team ID
        user_id: User ID to check
        permission_level: Permission level ("owner", "admin", "member", "viewer", "read")

    Returns:
        True if user has permission, False otherwise
    """
    # Map permission levels to required roles
    role_map = {
        "owner": [TeamMemberRole.OWNER],
        "admin": [TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
        "member": [TeamMemberRole.OWNER, TeamMemberRole.ADMIN, TeamMemberRole.MEMBER],
        "viewer": [
            TeamMemberRole.OWNER,
            TeamMemberRole.ADMIN,
            TeamMemberRole.MEMBER,
            TeamMemberRole.VIEWER,
        ],
        "read": [
            TeamMemberRole.OWNER,
            TeamMemberRole.ADMIN,
            TeamMemberRole.MEMBER,
            TeamMemberRole.VIEWER,
        ],
    }

    # Get allowed roles based on permission level
    allowed_roles = role_map.get(permission_level.lower(), [])
    if not allowed_roles:
        # Default to requiring admin for unknown permission levels
        allowed_roles = [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]

    # Get the user's team membership
    member = await get_team_member(db, team_id, user_id, include_all_statuses=False)

    # Check if user is a member with the required role
    if member and member.role in allowed_roles:
        return True

    return False


def create_team_permission_dependency(required_roles: List[TeamMemberRole]):
    """
    Create a dependency for team-based permission checking.

    Args:
        required_roles: List of roles that are allowed to perform the action

    Returns:
        A dependency function that can be used with FastAPI
    """

    async def has_team_permission(team_id: UUID, db: AsyncSession, current_user: dict) -> TeamMember:
        """
        Check if current user has the required role for the team.

        Args:
            team_id: Team ID from path parameter
            db: Database session
            current_user: Current user from auth dependency

        Returns:
            TeamMember object if user has permission

        Raises:
            HTTPException: If user doesn't have required permission
        """
        return await ensure_team_permission(db, team_id, current_user["id"], required_roles)

    return has_team_permission
