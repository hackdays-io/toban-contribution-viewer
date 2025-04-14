"""
API endpoints for team member management.
"""

import logging
from datetime import datetime
from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.team.schemas import TeamMemberCreate, TeamMemberInvite, TeamMemberResponse, TeamMemberUpdate
from app.core.auth import get_current_user
from app.db.session import get_async_db

# TeamMemberRole is imported but used only for type hints in docstrings
from app.services.team.members import TeamMemberService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def get_team_members(
    team_id: UUID,
    status: str = "active",
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Get members of a team by status.

    Args:
        team_id: Team ID to get members for
        status: Filter by invitation status ("active", "pending", "expired", "inactive", or "all")
        db: Database session
        current_user: Current authenticated user

    Returns:
        List of team members
    """
    logger.info(
        f"User {current_user['id']} requesting members for team {team_id} with status={status}"
    )

    # Get team members based on the requested status
    if status == "all":
        # Get all members regardless of status
        members = await TeamMemberService.get_team_members_by_status(
            db=db, team_id=team_id, user_id=current_user["id"], status=None
        )
    else:
        # Get members with the specific status
        members = await TeamMemberService.get_team_members_by_status(
            db=db, team_id=team_id, user_id=current_user["id"], status=status
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


@router.post("/{team_id}/members/{member_id}/resend-invite")
async def resend_team_invitation(
    team_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Resend an invitation to a pending team member.

    Args:
        team_id: Team ID
        member_id: Member ID to resend invitation to
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    logger.info(
        f"User {current_user['id']} resending invitation to member {member_id} in team {team_id}"
    )

    result = await TeamMemberService.resend_invitation(
        db=db, team_id=team_id, member_id=member_id, user_id=current_user["id"]
    )

    return result


@router.post("/{team_id}/members/{member_id}/debug-accept-invite")
async def debug_accept_invitation(
    team_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Debug endpoint to simulate accepting an invitation.
    This endpoint is for testing purposes only.

    Args:
        team_id: Team ID
        member_id: Member ID to accept invitation for
        db: Database session
        current_user: Current authenticated user

    Returns:
        Status message
    """
    logger.info(
        f"DEBUG: User {current_user['id']} simulating invitation acceptance for member {member_id} in team {team_id}"
    )

    # Get the member to update
    member = await TeamMemberService.get_team_member_by_id(
        db=db,
        team_id=team_id,
        member_id=member_id,
        user_id=current_user["id"],
        include_inactive=True,
    )

    if not member:
        logger.warning(f"Member {member_id} not found for debug acceptance")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found"
        )

    # Check if member has a pending invitation
    if member.invitation_status not in ["pending", "expired"]:
        logger.warning(
            f"Cannot accept invitation for member {member_id} with status {member.invitation_status}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept invitation with status: {member.invitation_status}",
        )

    try:
        # Update to active status
        member.invitation_status = "active"
        member.invitation_token = None  # Clear the token since it's been "used"
        member.invitation_expires_at = None  # Clear expiration
        member.last_active_at = datetime.utcnow()  # Set last active time

        # If this is a pending user (user_id starts with "pending_"), we would normally
        # replace the temporary user_id with the actual user's ID here
        # For debug purposes, we'll leave it as is

        # Save changes
        await db.commit()
        await db.refresh(member)

        # Update team size counter
        await TeamMemberService.update_team_size(db, team_id)

        return {
            "status": "success",
            "message": f"DEBUG: Invitation for {member.email} has been accepted",
            "note": "This is a debug feature for testing purposes only",
        }

    except Exception as e:
        logger.error(f"Error in debug accept invitation: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while simulating invitation acceptance",
        )
