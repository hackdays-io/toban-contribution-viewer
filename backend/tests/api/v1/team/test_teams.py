"""
Tests for team API endpoints.
"""

from typing import Dict

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team, TeamMember, TeamMemberRole


@pytest.fixture
def team_data() -> Dict:
    """
    Fixture for test team data.
    """
    return {
        "name": "Test Team",
        "slug": "test-team",
        "description": "Team for testing",
        "is_personal": False,
    }


@pytest.fixture
async def test_team(db: AsyncSession, test_user_id: str) -> Team:
    """
    Fixture for a test team.

    Args:
        db: Database session
        test_user_id: Test user ID for team owner

    Returns:
        Created test team
    """
    # Create a team
    team = Team(
        name="Test Team",
        slug="test-team",
        description="A team for testing",
        created_by_user_id=test_user_id,
        is_personal=False,
    )
    db.add(team)
    await db.flush()

    # Add the test user as owner
    member = TeamMember(
        team_id=team.id,
        user_id=test_user_id,
        role=TeamMemberRole.OWNER,
        invitation_status="active",
    )
    db.add(member)
    await db.commit()

    return team


@pytest.mark.asyncio
async def test_create_team(
    client: AsyncClient, test_user_auth_header: Dict, team_data: Dict
):
    """
    Test creating a team.
    """
    response = await client.post(
        "/api/v1/teams/", json=team_data, headers=test_user_auth_header
    )

    assert response.status_code == 201

    data = response.json()
    assert data["name"] == team_data["name"]
    assert data["slug"] == team_data["slug"]
    assert data["description"] == team_data["description"]
    assert data["is_personal"] == team_data["is_personal"]
    assert data["created_by_user_id"] is not None
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_get_teams(
    client: AsyncClient, test_user_auth_header: Dict, test_team: Team
):
    """
    Test getting a list of teams for the current user.
    """
    response = await client.get("/api/v1/teams/", headers=test_user_auth_header)

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # Check that the test team is in the list
    team_ids = [team["id"] for team in data]
    assert str(test_team.id) in team_ids


@pytest.mark.asyncio
async def test_get_team_by_id(
    client: AsyncClient, test_user_auth_header: Dict, test_team: Team
):
    """
    Test getting a team by ID.
    """
    response = await client.get(
        f"/api/v1/teams/{test_team.id}", headers=test_user_auth_header
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(test_team.id)
    assert data["name"] == test_team.name
    assert data["slug"] == test_team.slug


@pytest.mark.asyncio
async def test_get_team_by_slug(
    client: AsyncClient, test_user_auth_header: Dict, test_team: Team
):
    """
    Test getting a team by slug.
    """
    response = await client.get(
        f"/api/v1/teams/by-slug/{test_team.slug}", headers=test_user_auth_header
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(test_team.id)
    assert data["name"] == test_team.name
    assert data["slug"] == test_team.slug


@pytest.mark.asyncio
async def test_update_team(
    client: AsyncClient, test_user_auth_header: Dict, test_team: Team
):
    """
    Test updating a team.
    """
    update_data = {"name": "Updated Team Name", "description": "Updated description"}

    response = await client.put(
        f"/api/v1/teams/{test_team.id}", json=update_data, headers=test_user_auth_header
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(test_team.id)
    assert data["name"] == update_data["name"]
    assert data["description"] == update_data["description"]
    assert data["slug"] == test_team.slug  # Slug wasn't updated


@pytest.mark.asyncio
async def test_delete_team(
    client: AsyncClient, test_user_auth_header: Dict, test_team: Team
):
    """
    Test deleting a team.
    """
    response = await client.delete(
        f"/api/v1/teams/{test_team.id}", headers=test_user_auth_header
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

    # Verify team is no longer accessible
    response = await client.get(
        f"/api/v1/teams/{test_team.id}", headers=test_user_auth_header
    )

    assert response.status_code == 404
