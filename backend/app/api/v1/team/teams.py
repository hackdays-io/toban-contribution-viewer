"""
API endpoints for team management.
"""

import logging
from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.team.schemas import TeamCreate, TeamResponse, TeamUpdate
from app.core.auth import get_current_user
from app.db.session import get_async_db

# These models are imported but used only in type hints in docstrings
from app.services.team.teams import TeamService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[TeamResponse])
async def get_teams(
    include_members: bool = Query(
        False, description="Include team members in response"
    ),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get all teams that the current user is a member of.

    Args:
        include_members: Whether to include team members in the response
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of teams
    """
    logger.info(f"User {current_user['id']} requesting their teams")

    teams = await TeamService.get_teams_for_user(
        db=db, user_id=current_user["id"], include_members=include_members
    )

    return teams


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team: TeamCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Create a new team.

    Args:
        team: Team data for creation
        db: Database session
        current_user: Current authenticated user

    Returns:
        Newly created team
    """
    logger.info(f"User {current_user['id']} creating team: {team}")

    # If no slug is provided, generate one from the name
    if not team.slug:
        team.slug = await TeamService.generate_unique_slug(db, team.name)

    # Create the team
    created_team = await TeamService.create_team(
        db=db,
        team_data=team.dict(),
        user_id=current_user["id"],
        user_email=current_user.get("email"),
    )

    return created_team


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    include_members: bool = Query(
        False, description="Include team members in response"
    ),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get a team by ID.

    Args:
        team_id: Team ID to get
        include_members: Whether to include team members in the response
        db: Database session
        current_user: Current authenticated user

    Returns:
        Team data if found and user has access
    """
    logger.info(f"User {current_user['id']} requesting team {team_id}")

    # Get the team
    team = await TeamService.get_team_by_id(db, team_id, include_members)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )

    # Verify the user has access
    from app.core.team_scoped_access import require_team_access

    # This line will raise an exception if the user doesn't have access
    await require_team_access(
        request=None, team_id=team_id, db=db, current_user=current_user
    )

    return team


@router.get("/by-slug/{slug}", response_model=TeamResponse)
async def get_team_by_slug(
    slug: str,
    include_members: bool = Query(
        False, description="Include team members in response"
    ),
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get a team by slug.

    Args:
        slug: Team slug to get
        include_members: Whether to include team members in the response
        db: Database session
        current_user: Current authenticated user

    Returns:
        Team data if found and user has access
    """
    logger.info(f"User {current_user['id']} requesting team with slug {slug}")

    # Get the team
    team = await TeamService.get_team_by_slug(db, slug, include_members)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )

    # Verify the user has access
    from app.core.team_scoped_access import require_team_access

    # This line will raise an exception if the user doesn't have access
    await require_team_access(
        request=None, team_id=team.id, db=db, current_user=current_user
    )

    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    team_update: TeamUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Update a team.

    Args:
        team_id: Team ID to update
        team_update: Updated team data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated team data
    """
    logger.info(f"User {current_user['id']} updating team {team_id}")

    # Check admin or owner permissions
    from app.core.team_scoped_access import require_team_admin

    await require_team_admin(
        request=None, team_id=team_id, db=db, current_user=current_user
    )

    # Update the team (service handles additional permission checks)
    updated_team = await TeamService.update_team(
        db=db,
        team_id=team_id,
        team_data=team_update.dict(exclude_unset=True),
        user_id=current_user["id"],
    )

    return updated_team


@router.delete("/{team_id}")
async def delete_team(
    team_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Delete a team.

    Args:
        team_id: Team ID to delete
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    logger.info(f"User {current_user['id']} deleting team {team_id}")

    # Check owner permissions (only owners can delete teams)
    from app.core.team_scoped_access import require_team_owner

    await require_team_owner(
        request=None, team_id=team_id, db=db, current_user=current_user
    )

    # Delete the team
    result = await TeamService.delete_team(
        db=db, team_id=team_id, user_id=current_user["id"]
    )

    return result
