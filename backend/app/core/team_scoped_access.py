"""
Middleware and dependencies for team-scoped access control.
"""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db.session import get_async_db
from app.models.team import TeamMemberRole
from app.services.team.permissions import get_team_member

logger = logging.getLogger(__name__)


class TeamScopedAccess:
    """
    Dependency class for team-scoped access control.

    This class can be used as a dependency in FastAPI route handlers to check
    if the current user has access to the requested team resource.
    """

    def __init__(
        self,
        required_roles: Optional[List[TeamMemberRole]] = None,
        get_team_id_from_path: bool = True,
        path_param_name: str = "team_id",
    ):
        """
        Initialize the dependency.

        Args:
            required_roles: List of roles allowed to access the resource. If None,
                          any team member can access.
            get_team_id_from_path: Whether to get team_id from path parameter.
            path_param_name: Name of path parameter containing team_id.
        """
        self.required_roles = required_roles or [
            TeamMemberRole.OWNER,
            TeamMemberRole.ADMIN,
            TeamMemberRole.MEMBER,
            TeamMemberRole.VIEWER,
        ]
        self.get_team_id_from_path = get_team_id_from_path
        self.path_param_name = path_param_name

    async def __call__(
        self,
        request: Optional[Request] = None,
        team_id: Optional[UUID] = None,
        db: AsyncSession = Depends(get_async_db),
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        """
        Check if current user has access to the team resource.

        Args:
            request: FastAPI request object (optional)
            team_id: Team ID (used if not getting from path)
            db: Database session
            current_user: Current authenticated user

        Returns:
            The current_user dict with additional team_role field

        Raises:
            HTTPException: If user doesn't have access
        """
        # Get team_id from path parameter if needed and if request is available
        if self.get_team_id_from_path and request is not None:
            try:
                # Get team_id from path parameter
                path_team_id = request.path_params.get(self.path_param_name)
                if path_team_id:
                    team_id = UUID(str(path_team_id))
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid team_id in path parameter: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid team ID format",
                )

        if not team_id:
            logger.error("No team_id provided for team-scoped access check")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Team ID is required"
            )

        # Check if the user is a member of the team
        member = await get_team_member(db, team_id, current_user["id"])

        if not member:
            logger.warning(
                f"User {current_user['id']} denied access to team {team_id} - not a member"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this team",
            )

        # Check if the user's role is allowed
        if member.role not in self.required_roles:
            logger.warning(
                f"User {current_user['id']} denied access to team {team_id} - insufficient role "
                f"(has {member.role}, needs one of {self.required_roles})"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have the required permissions for this action",
            )

        # Add team role to the user object
        current_user["team_role"] = member.role

        return current_user


# Pre-defined dependencies for common role requirements
require_team_owner = TeamScopedAccess(required_roles=[TeamMemberRole.OWNER])
require_team_admin = TeamScopedAccess(
    required_roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
)
require_team_member = TeamScopedAccess(
    required_roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN, TeamMemberRole.MEMBER]
)
require_team_access = TeamScopedAccess()  # Any team role (including viewer)


# Function to create custom role requirements
def require_team_roles(*roles: TeamMemberRole):
    """
    Create a dependency requiring specific team roles.

    Args:
        *roles: Roles to require

    Returns:
        TeamScopedAccess dependency instance
    """
    return TeamScopedAccess(required_roles=list(roles))


# Simplified direct function for programmatic usage
async def check_team_access(
    team_id: UUID,
    user_id: str,
    db: AsyncSession,
    roles: Optional[List[TeamMemberRole]] = None,
) -> bool:
    """
    Check if a user has access to a team with specific roles.

    Args:
        team_id: Team ID
        user_id: User ID
        db: Database session
        roles: Required roles (defaults to all roles)

    Returns:
        True if user has access, False otherwise
    """
    try:
        # Check if the user is a member of the team
        member = await get_team_member(db, team_id, user_id)

        if not member:
            logger.warning(
                f"User {user_id} denied access to team {team_id} - not a member"
            )
            return False

        # If no specific roles required, any membership is sufficient
        if not roles:
            return True

        # Check if the user's role is in the allowed roles
        if member.role not in roles:
            logger.warning(
                f"User {user_id} denied access to team {team_id} - insufficient role "
                f"(has {member.role}, needs one of {roles})"
            )
            return False

        return True
    except Exception as e:
        logger.error(f"Error checking team access: {str(e)}")
        return False
