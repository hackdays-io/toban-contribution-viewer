"""
API endpoints for team member management.
"""

import logging
from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.team.schemas import TeamMemberCreate, TeamMemberInvite, TeamMemberResponse, TeamMemberUpdate
from app.core.auth import get_current_user
from app.db.session import get_async_db
from app.models.team import TeamMemberRole
from app.services.team.members import TeamMemberService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def get_team_members(
    team_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get all members of a team.

    Args:
        team_id: Team ID to get members for
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of team members
    """
    logger.info(f"User {current_user['id']} requesting members for team {team_id}")

    members = await TeamMemberService.get_team_members(
        db=db, team_id=team_id, user_id=current_user["id"]
    )

    return members


@router.get("/{team_id}/members/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    team_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get a specific team member.

    Args:
        team_id: Team ID
        member_id: Member ID to get
        db: Database session
        current_user: Current authenticated user

    Returns:
        Team member data
    """
    logger.info(
        f"User {current_user['id']} requesting member {member_id} in team {team_id}"
    )

    member = await TeamMemberService.get_team_member_by_id(
        db=db, team_id=team_id, member_id=member_id, user_id=current_user["id"]
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found"
        )

    return member


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    member: TeamMemberCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Add a new member to a team.

    Args:
        team_id: Team ID to add member to
        member: Member data for creation
        db: Database session
        current_user: Current authenticated user

    Returns:
        Newly created team member
    """
    logger.info(f"User {current_user['id']} adding new member to team {team_id}")

    created_member = await TeamMemberService.add_team_member(
        db=db, team_id=team_id, member_data=member.dict(), user_id=current_user["id"]
    )

    return created_member


@router.post("/{team_id}/invite", status_code=status.HTTP_202_ACCEPTED)
async def invite_team_member(
    team_id: UUID,
    invitation: TeamMemberInvite,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Invite a user to join a team.

    Args:
        team_id: Team ID to invite to
        invitation: Invitation data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    logger.info(
        f"User {current_user['id']} inviting {invitation.email} to team {team_id}"
    )

    # Prepare member data for invitation
    member_data = {
        "email": invitation.email,
        "role": invitation.role,
        "invitation_status": "pending",
        # Generate a temporary user_id using the email as identifier until they accept
        "user_id": f"pending_{invitation.email.replace('@', '_at_')}",
    }

    # Create the pending member
    await TeamMemberService.add_team_member(
        db=db, team_id=team_id, member_data=member_data, user_id=current_user["id"]
    )

    # In a real system, you would send an email here with the invitation link

    return {
        "status": "success",
        "message": f"Invitation sent to {invitation.email}",
        "note": "In a production system, an email would be sent with an invitation link",
    }


@router.put("/{team_id}/members/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    member_update: TeamMemberUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Update a team member.

    Args:
        team_id: Team ID
        member_id: Member ID to update
        member_update: Updated member data
        db: Database session
        current_user: Current authenticated user

    Returns:
        Updated team member data
    """
    logger.info(
        f"User {current_user['id']} updating member {member_id} in team {team_id}"
    )

    updated_member = await TeamMemberService.update_team_member(
        db=db,
        team_id=team_id,
        member_id=member_id,
        member_data=member_update.dict(exclude_unset=True),
        user_id=current_user["id"],
    )

    return updated_member


@router.delete("/{team_id}/members/{member_id}")
async def remove_team_member(
    team_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Remove a member from a team.

    Args:
        team_id: Team ID
        member_id: Member ID to remove
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    logger.info(
        f"User {current_user['id']} removing member {member_id} from team {team_id}"
    )

    result = await TeamMemberService.remove_team_member(
        db=db, team_id=team_id, member_id=member_id, user_id=current_user["id"]
    )

    return result
