"""
Team authentication API endpoints.

These endpoints handle team context in the authentication flow including:
- Getting the current user's team context
- Switching between teams
- Refreshing JWT tokens with team context
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_token_with_team_context, get_current_user, get_user_team_context, switch_team_context
from app.db.session import get_async_db

router = APIRouter(prefix="/auth", tags=["team auth"])


class TeamContextResponse(BaseModel):
    """Response model for team context endpoints."""

    current_team_id: Optional[str] = None
    current_team_role: Optional[str] = None
    teams: list = Field(default_factory=list)
    token: Optional[str] = None


class SwitchTeamRequest(BaseModel):
    """Request model for switching teams."""

    team_id: UUID
    refresh_token: bool = True


@router.get("/context", response_model=TeamContextResponse)
async def get_team_context(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Get the current user's team context.

    Returns the user's current team context, including:
    - Current team ID and role
    - List of teams the user belongs to
    - If the user has no current team, one will be set from their available teams
    """
    user_with_teams = await get_user_team_context(current_user, db)

    return {
        "current_team_id": user_with_teams.get("current_team_id"),
        "current_team_role": user_with_teams.get("current_team_role"),
        "teams": user_with_teams.get("teams", []),
    }


@router.post("/switch-team", response_model=TeamContextResponse)
async def switch_team(
    request: SwitchTeamRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Switch the current user's team context.

    Changes the user's current team and optionally returns a new JWT token
    with the updated team context.

    Args:
        request: Contains team_id to switch to and whether to refresh the token

    Returns:
        Updated team context and optionally a new JWT token
    """
    user_with_new_team = await switch_team_context(request.team_id, current_user, db)

    response = {
        "current_team_id": user_with_new_team.get("current_team_id"),
        "current_team_role": user_with_new_team.get("current_team_role"),
        "teams": user_with_new_team.get("teams", []),
    }

    # If requested, generate a new token with the updated team context
    if request.refresh_token:
        token = create_token_with_team_context(
            user_id=user_with_new_team["id"],
            email=user_with_new_team.get("email", ""),
            role=user_with_new_team.get("role", "authenticated"),
            teams=user_with_new_team.get("teams", []),
            current_team_id=user_with_new_team.get("current_team_id"),
            current_team_role=user_with_new_team.get("current_team_role"),
        )
        response["token"] = token

    return response


@router.post("/refresh-token", response_model=TeamContextResponse)
async def refresh_team_token(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Refresh the user's authentication token with team context.

    Gets the current user's team context and generates a new JWT token
    that includes this context.

    Returns:
        Team context and a new JWT token
    """
    user_with_teams = await get_user_team_context(current_user, db)

    if not user_with_teams.get("teams"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no teams",
        )

    token = create_token_with_team_context(
        user_id=user_with_teams["id"],
        email=user_with_teams.get("email", ""),
        role=user_with_teams.get("role", "authenticated"),
        teams=user_with_teams.get("teams", []),
        current_team_id=user_with_teams.get("current_team_id"),
        current_team_role=user_with_teams.get("current_team_role"),
    )

    return {
        "current_team_id": user_with_teams.get("current_team_id"),
        "current_team_role": user_with_teams.get("current_team_role"),
        "teams": user_with_teams.get("teams", []),
        "token": token,
    }
