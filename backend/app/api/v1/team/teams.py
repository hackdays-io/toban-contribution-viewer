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


def convert_team_to_dict(team, include_members: bool = False) -> Dict:
    """
    Convert a Team ORM object to a dictionary to avoid lazy loading issues.

    Args:
        team: Team ORM object
        include_members: Whether to include team members in the result

    Returns:
        Dictionary representation of the team
    """
    team_dict = {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "description": team.description,
        "avatar_url": team.avatar_url,
        "is_personal": team.is_personal,
        "created_by_user_id": team.created_by_user_id,
        "created_by_email": team.created_by_email,
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "team_size": team.team_size or 0,
    }

    # Check if members are already loaded to avoid lazy loading
    try:
        members_loaded = (
            hasattr(team, "_sa_instance_state")
            and hasattr(team._sa_instance_state, "attrs")
            and hasattr(team._sa_instance_state.attrs, "members")
            and (
                getattr(team._sa_instance_state.attrs.members, "loaded", False)
                or team._sa_instance_state.attrs.members.loaded_value is not None
            )
        )
    except Exception as e:
        logger.error(f"Error checking if members are loaded: {str(e)}")
        members_loaded = False

    if include_members and members_loaded and hasattr(team, "members"):
        try:
            # Convert members to dicts to avoid further lazy loading
            member_list = []
            for member in team.members:
                member_dict = {
                    "id": member.id,
                    "team_id": member.team_id,
                    "user_id": member.user_id,
                    "email": member.email,
                    "display_name": member.display_name,
                    "role": member.role,
                    "invitation_status": member.invitation_status,
                    "created_at": member.created_at,
                    "last_active_at": member.last_active_at,
                }
                member_list.append(member_dict)

            team_dict["members"] = member_list
        except Exception as e:
            logger.error(f"Error loading team members: {str(e)}")
            team_dict["members"] = []
    else:
        team_dict["members"] = []

    return team_dict


@router.get("/", response_model=List[TeamResponse])
async def get_teams(
    include_members: bool = Query(False, description="Include team members in response"),
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
    logger.debug(f"Getting teams for user: {current_user['id']}")

    # Get the teams from the service
    teams = await TeamService.get_teams_for_user(db=db, user_id=current_user["id"], include_members=include_members)

    # Convert to dictionaries to avoid lazy loading issues
    team_responses = [convert_team_to_dict(team, include_members) for team in teams]
    return team_responses


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
    logger.debug(f"Creating team: {team.name} for user: {current_user['id']}")

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

    # Convert to dictionary and include members since it's a creation operation
    return convert_team_to_dict(created_team, include_members=True)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    include_members: bool = Query(False, description="Include team members in response"),
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
    logger.debug(f"Getting team {team_id} for user: {current_user['id']}")

    # Get the team
    team = await TeamService.get_team_by_id(db, team_id, include_members)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Verify the user has access
    from app.core.team_scoped_access import check_team_access

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team_id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Convert to dictionary using our helper function
    return convert_team_to_dict(team, include_members)


@router.get("/by-slug/{slug}", response_model=TeamResponse)
async def get_team_by_slug(
    slug: str,
    include_members: bool = Query(False, description="Include team members in response"),
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
    logger.debug(f"Getting team with slug: {slug} for user: {current_user['id']}")

    # Get the team
    team = await TeamService.get_team_by_slug(db, slug, include_members)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Verify the user has access
    from app.core.team_scoped_access import check_team_access

    # Check if user has access to this team
    has_access = await check_team_access(team_id=team.id, user_id=current_user["id"], db=db)

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this team",
        )

    # Convert to dictionary using our helper function
    return convert_team_to_dict(team, include_members)


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
    logger.debug(f"Updating team {team_id} for user: {current_user['id']}")

    # Check admin or owner permissions
    from app.core.team_scoped_access import check_team_access
    from app.models.team import TeamMemberRole

    has_access = await check_team_access(
        team_id=team_id,
        user_id=current_user["id"],
        db=db,
        roles=[TeamMemberRole.OWNER, TeamMemberRole.ADMIN],
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have admin access to this team",
        )

    # Update the team (service handles additional permission checks)
    updated_team = await TeamService.update_team(
        db=db,
        team_id=team_id,
        team_data=team_update.dict(exclude_unset=True),
        user_id=current_user["id"],
    )

    # For updates, we don't typically include members data
    return convert_team_to_dict(updated_team, include_members=False)


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
    from app.core.team_scoped_access import check_team_access
    from app.models.team import TeamMemberRole

    has_access = await check_team_access(
        team_id=team_id, user_id=current_user["id"], db=db, roles=[TeamMemberRole.OWNER]
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team owners can delete a team",
        )

    # Delete the team
    result = await TeamService.delete_team(db=db, team_id=team_id, user_id=current_user["id"])

    return result
