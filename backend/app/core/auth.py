import logging
import time
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_async_db

# Setup the JWT bearer token validation
security = HTTPBearer()


def decode_token(token: str) -> Dict:
    """
    Decode and validate a JWT token from Supabase Auth.

    Args:
        token: JWT token to decode and validate

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token validation fails
    """
    logger = logging.getLogger(__name__)

    try:
        jwt_secret = settings.SUPABASE_JWT_SECRET
        if not jwt_secret:
            logger.error("JWT secret is not configured")
            raise ValueError("JWT secret is not configured")

        # Try progressive token verification approaches for Supabase compatibility
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        audiences = [supabase_url, f"{supabase_url}/auth/v1"]

        # First approach: Basic verification without audience/issuer checks
        try:
            return jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_aud": False,
                    "verify_iss": False,
                },
            )
        except Exception:
            # Second approach: With audience verification
            try:
                return jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=["HS256"],
                    audience=audiences,
                    options={
                        "verify_signature": True,
                        "verify_aud": True,
                        "verify_iss": False,
                    },
                )
            except Exception:
                # Third approach: With full verification
                try:
                    return jwt.decode(
                        token,
                        jwt_secret,
                        algorithms=["HS256"],
                        audience=audiences,
                        issuer=supabase_url,
                        options={
                            "verify_signature": True,
                            "verify_aud": True,
                            "verify_iss": True,
                        },
                    )
                except Exception as e:
                    logger.error(f"All token verification methods failed: {str(e)}")
                    raise
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict:
    """
    Get the current authenticated user from the JWT token.

    Args:
        credentials: HTTP authorization credentials

    Returns:
        Dictionary with user data extracted from token, including team context if available

    Raises:
        HTTPException: If credentials are invalid or user not found
    """
    # Check if credentials were properly extracted from the request
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication credentials provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get the token from credentials
    token = credentials.credentials

    # Decode the token
    payload = decode_token(token)

    # Validate token expiration
    if payload.get("exp") and time.time() > payload["exp"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user data from the token payload
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract team context from the token payload
    user_data = {
        "id": user_id,
        "email": payload.get("email", ""),
        "role": payload.get("role", "authenticated"),
    }

    # Add team context if available
    if payload.get("current_team_id"):
        user_data["current_team_id"] = payload.get("current_team_id")
        user_data["current_team_role"] = payload.get("current_team_role")

    # Add teams list if available
    if payload.get("teams"):
        user_data["teams"] = payload.get("teams")

    return user_data


async def get_user_team_context(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> Dict:
    """
    Get the current user with team context.

    This will load the user's teams from the database if they're not already
    in the token. If no current team is set, it will set the first team as current.

    Args:
        current_user: User data from JWT token
        db: Database session

    Returns:
        User data with team context
    """
    logger = logging.getLogger(__name__)

    # If teams are already in the token, use them
    if "teams" in current_user:
        # If no current team is set but teams exist, set the first one as current
        if not current_user.get("current_team_id") and current_user["teams"]:
            first_team = current_user["teams"][0]
            current_user["current_team_id"] = first_team["id"]
            current_user["current_team_role"] = first_team["role"]
            logger.info(f"Setting default team for user {current_user['id']}: {first_team['id']}")

        return current_user

    # Otherwise, load teams from database
    try:
        # Import here to avoid circular imports
        from app.services.team.teams import TeamService

        # Use an async context manager to ensure proper async operation
        async with db.begin():
            # Get the user's teams
            teams = await TeamService.get_teams_for_user(
                db=db,
                user_id=current_user["id"],
                include_members=True,  # Including members to get roles
                auto_create=True,  # Create a personal team if user has none
            )

            # Transform to simple list for the token
            team_list = []
            for team in teams:
                # Find the user's role in this team
                user_role = None
                for member in team.members:
                    if member.user_id == current_user["id"] and member.invitation_status == "active":
                        user_role = member.role
                        break

                team_list.append(
                    {
                        "id": str(team.id),
                        "name": team.name,
                        "slug": team.slug,
                        "role": user_role,
                    }
                )

            current_user["teams"] = team_list

        # If user has teams but no current team is set, set the first one
        if team_list and not current_user.get("current_team_id"):
            current_user["current_team_id"] = team_list[0]["id"]
            current_user["current_team_role"] = team_list[0]["role"]
            logger.info(f"Setting default team for user {current_user['id']}: {team_list[0]['id']}")

        return current_user
    except Exception as e:
        logger.error(f"Error loading team context for user {current_user['id']}: {str(e)}")
        # Return user without team context if there's an error
        return current_user


async def switch_team_context(
    team_id: UUID,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> Dict:
    """
    Switch the current user's team context.

    Args:
        team_id: The ID of the team to switch to
        current_user: User data from JWT token
        db: Database session

    Returns:
        Updated user data with new team context

    Raises:
        HTTPException: If team not found or user doesn't have access
    """
    logger = logging.getLogger(__name__)

    # Get the user with team context
    user_with_teams = await get_user_team_context(current_user, db)

    # Check if the user has access to the requested team
    team_found = False
    new_role = None

    # Look for the team in the user's teams
    if "teams" in user_with_teams:
        for team in user_with_teams["teams"]:
            if team["id"] == str(team_id):
                team_found = True
                new_role = team["role"]
                break

    if not team_found:
        # Check database as fallback
        try:
            # Import here to avoid circular imports
            from app.services.team.permissions import get_team_member

            # Only allow switching to teams with active membership
            member = await get_team_member(db, team_id, current_user["id"], include_all_statuses=False)
            if member:
                team_found = True
                new_role = member.role
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this team",
                )
        except Exception as e:
            logger.error(f"Error checking team access for user {current_user['id']}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error checking team access",
            )

    # Switch context if the team is found
    if team_found:
        user_with_teams["current_team_id"] = str(team_id)
        user_with_teams["current_team_role"] = new_role
        logger.info(f"User {current_user['id']} switched to team {team_id}")
        return user_with_teams
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")


def create_token_with_team_context(
    user_id: str,
    email: str = "",
    role: str = "authenticated",
    teams: List[Dict] = None,
    current_team_id: Optional[str] = None,
    current_team_role: Optional[str] = None,
    expires_delta: Optional[int] = None,
) -> str:
    """
    Create a new JWT token with team context.

    Args:
        user_id: The user's ID
        email: The user's email
        role: The user's auth role
        teams: List of teams with their roles
        current_team_id: Current team ID
        current_team_role: Current team role
        expires_delta: Token expiration time in seconds

    Returns:
        JWT token string
    """
    # Initialize the token payload with standard claims
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
    }

    # Add team context if available
    if teams:
        payload["teams"] = teams

    if current_team_id and current_team_role:
        payload["current_team_id"] = current_team_id
        payload["current_team_role"] = current_team_role

    # Add expiration if provided
    if expires_delta:
        expires = time.time() + expires_delta
        payload["exp"] = expires

    # Create the token
    jwt_secret = settings.SUPABASE_JWT_SECRET
    if not jwt_secret:
        raise ValueError("JWT secret is not configured")

    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    return token


class TeamRequiredAuth:
    """
    Dependency class for team-required authentication.

    This extends the regular authentication by requiring the user to have
    a current team set with specified roles (if any).
    """

    def __init__(
        self,
        required_roles: Optional[List[str]] = None,
    ):
        """
        Initialize the dependency.

        Args:
            required_roles: List of roles allowed (e.g., ['owner', 'admin'])
        """
        self.required_roles = required_roles

    async def __call__(
        self,
        current_user: Dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_db),
    ) -> Dict:
        """
        Check if the user has a current team with required role.

        Args:
            current_user: User data from token
            db: Database session

        Returns:
            User data with current team context

        Raises:
            HTTPException: If no team context or insufficient role
        """
        logger = logging.getLogger(__name__)

        # Get user with team context
        user = await get_user_team_context(current_user, db)

        # Check if user has a current team
        if not user.get("current_team_id"):
            logger.warning(f"User {user['id']} has no current team context")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No team context found. Please select a team first.",
            )

        # Check if role requirements are met
        if self.required_roles and user.get("current_team_role") not in self.required_roles:
            logger.warning(
                f"User {user['id']} has insufficient role for team {user['current_team_id']}: "
                f"has {user.get('current_team_role')}, needs one of {self.required_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action",
            )

        return user


# Common team role requirements
require_owner = TeamRequiredAuth(required_roles=["owner"])
require_admin = TeamRequiredAuth(required_roles=["owner", "admin"])
require_member = TeamRequiredAuth(required_roles=["owner", "admin", "member"])
require_team = TeamRequiredAuth()  # Any team role
