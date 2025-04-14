"""
Tests for team members API endpoints.
"""

import uuid
from typing import Dict

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team, TeamMember, TeamMemberRole


@pytest.fixture
async def test_team_with_members(db: AsyncSession, test_user_id: str) -> Dict:
    """
    Fixture for a test team with multiple members.

    Args:
        db: Database session
        test_user_id: Test user ID for team owner

    Returns:
        Dict with team and member information
    """
    # Create a team
    team = Team(
        name="Team With Members",
        slug="team-with-members",
        description="A team with multiple members for testing",
        created_by_user_id=test_user_id,
        is_personal=False,
    )
    db.add(team)
    await db.flush()

    # Add the test user as owner
    owner = TeamMember(
        team_id=team.id,
        user_id=test_user_id,
        role=TeamMemberRole.OWNER,
        invitation_status="active",
    )
    db.add(owner)

    # Add an admin member
    admin_id = f"admin-user-{uuid.uuid4()}"
    admin = TeamMember(
        team_id=team.id,
        user_id=admin_id,
        role=TeamMemberRole.ADMIN,
        invitation_status="active",
    )
    db.add(admin)

    # Add a regular member
    member_id = f"member-user-{uuid.uuid4()}"
    member = TeamMember(
        team_id=team.id,
        user_id=member_id,
        role=TeamMemberRole.MEMBER,
        invitation_status="active",
    )
    db.add(member)

    # Add a viewer
    viewer_id = f"viewer-user-{uuid.uuid4()}"
    viewer = TeamMember(
        team_id=team.id,
        user_id=viewer_id,
        role=TeamMemberRole.VIEWER,
        invitation_status="active",
    )
    db.add(viewer)

    await db.commit()
    await db.refresh(team)

    return {
        "team": team,
        "owner": owner,
        "admin": admin,
        "member": member,
        "viewer": viewer,
    }


@pytest.mark.asyncio
async def test_get_team_members(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test getting a list of team members.
    """
    team = test_team_with_members["team"]

    response = await client.get(
        f"/api/v1/teams/{team.id}/members", headers=test_user_auth_header
    )

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4  # owner, admin, member, viewer

    # Check roles are represented
    roles = [member["role"] for member in data]
    assert TeamMemberRole.OWNER in roles
    assert TeamMemberRole.ADMIN in roles
    assert TeamMemberRole.MEMBER in roles
    assert TeamMemberRole.VIEWER in roles


@pytest.mark.asyncio
async def test_get_team_member(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test getting a specific team member.
    """
    team = test_team_with_members["team"]
    admin = test_team_with_members["admin"]

    response = await client.get(
        f"/api/v1/teams/{team.id}/members/{admin.id}", headers=test_user_auth_header
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(admin.id)
    assert data["role"] == TeamMemberRole.ADMIN
    assert data["user_id"] == admin.user_id


@pytest.mark.asyncio
async def test_add_team_member(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test adding a new team member.
    """
    team = test_team_with_members["team"]

    new_member_data = {
        "user_id": f"new-user-{uuid.uuid4()}",
        "role": TeamMemberRole.MEMBER,
        "display_name": "New Test User",
    }

    response = await client.post(
        f"/api/v1/teams/{team.id}/members",
        json=new_member_data,
        headers=test_user_auth_header,
    )

    assert response.status_code == 201

    data = response.json()
    assert data["user_id"] == new_member_data["user_id"]
    assert data["role"] == new_member_data["role"]
    assert data["display_name"] == new_member_data["display_name"]


@pytest.mark.asyncio
async def test_update_team_member(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test updating a team member.
    """
    team = test_team_with_members["team"]
    member = test_team_with_members["member"]

    update_data = {"role": TeamMemberRole.ADMIN, "display_name": "Updated Display Name"}

    response = await client.put(
        f"/api/v1/teams/{team.id}/members/{member.id}",
        json=update_data,
        headers=test_user_auth_header,
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(member.id)
    assert data["role"] == update_data["role"]
    assert data["display_name"] == update_data["display_name"]


@pytest.mark.asyncio
async def test_remove_team_member(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test removing a team member.
    """
    team = test_team_with_members["team"]
    viewer = test_team_with_members["viewer"]

    response = await client.delete(
        f"/api/v1/teams/{team.id}/members/{viewer.id}", headers=test_user_auth_header
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

    # Verify member is no longer accessible
    response = await client.get(
        f"/api/v1/teams/{team.id}/members/{viewer.id}", headers=test_user_auth_header
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_invite_team_member(
    client: AsyncClient, test_user_auth_header: Dict, test_team_with_members: Dict
):
    """
    Test inviting a user to a team.
    """
    team = test_team_with_members["team"]

    invitation_data = {
        "email": "test.invite@example.com",
        "role": TeamMemberRole.MEMBER,
    }

    response = await client.post(
        f"/api/v1/teams/{team.id}/invite",
        json=invitation_data,
        headers=test_user_auth_header,
    )

    assert response.status_code == 202

    data = response.json()
    assert data["status"] == "success"
    assert "invitation" in data["message"].lower()

    # Check if member with pending status was created
    response = await client.get(
        f"/api/v1/teams/{team.id}/members", headers=test_user_auth_header
    )

    assert response.status_code == 200
    members = response.json()

    # Find the pending invitation by checking emails
    pending_members = [m for m in members if m.get("email") == invitation_data["email"]]
    assert len(pending_members) == 1
    assert pending_members[0]["invitation_status"] == "pending"
