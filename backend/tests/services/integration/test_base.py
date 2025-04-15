"""
Tests for the base integration service.
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import (
    AccessLevel,
    Integration,
    IntegrationShare,
    IntegrationStatus,
    IntegrationType,
    ServiceResource,
    ShareLevel,
)
from app.models.team import Team
from app.services.integration.base import IntegrationService


@pytest.fixture
def mock_db():
    """Mock database session."""
    mock = AsyncMock(spec=AsyncSession)
    mock.get = AsyncMock()
    mock.execute = AsyncMock()
    mock.flush = AsyncMock()
    return mock


@pytest.fixture
def test_team():
    """Create a test team."""
    return Team(
        id=uuid.uuid4(),
        name="Test Team",
        slug="test-team",
        created_by_user_id="user123",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def test_user_id():
    """Test user ID."""
    return "user123"


@pytest.fixture
def test_integration(test_team):
    """Create a test integration."""
    return Integration(
        id=uuid.uuid4(),
        name="Test Slack",
        description="Test Slack integration",
        service_type=IntegrationType.SLACK,
        status=IntegrationStatus.ACTIVE,
        integration_metadata={"slack_id": "T12345"},
        owner_team_id=test_team.id,
        created_by_user_id="user123",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


class TestIntegrationService:
    """Tests for the IntegrationService class."""

    async def test_get_integration_owner(
        self, mock_db, test_integration, test_team, test_user_id
    ):
        """Test getting an integration as the owner."""
        # Setup
        mock_db.get.return_value = test_integration

        # Mock team query result
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [test_team]
        mock_db.execute.return_value = mock_result

        # Execute
        result = await IntegrationService.get_integration(
            db=mock_db,
            integration_id=test_integration.id,
            user_id=test_user_id,
        )

        # Assert
        assert result == test_integration
        mock_db.get.assert_called_once_with(Integration, test_integration.id)
        mock_db.execute.assert_called_once()

    async def test_create_integration(self, mock_db, test_team, test_user_id):
        """Test creating a new integration."""
        # Setup
        name = "New Integration"
        service_type = IntegrationType.SLACK
        description = "Test description"
        metadata = {"key": "value"}

        # Execute
        result = await IntegrationService.create_integration(
            db=mock_db,
            team_id=test_team.id,
            user_id=test_user_id,
            name=name,
            service_type=service_type,
            description=description,
            metadata=metadata,
        )

        # Assert
        assert result.name == name
        assert result.service_type == service_type
        assert result.description == description
        assert result.metadata == metadata
        assert result.owner_team_id == test_team.id
        assert result.created_by_user_id == test_user_id
        assert mock_db.add.call_count == 2  # Integration and event
        assert mock_db.flush.call_count == 1

    async def test_update_integration(self, mock_db, test_integration, test_user_id):
        """Test updating an integration."""
        # Setup
        mock_db.get.return_value = test_integration

        update_data = {
            "name": "Updated Name",
            "description": "Updated description",
            "status": IntegrationStatus.DISCONNECTED,
            "metadata": {"new_key": "new_value"},
        }

        # Execute
        result = await IntegrationService.update_integration(
            db=mock_db,
            integration_id=test_integration.id,
            user_id=test_user_id,
            data=update_data,
        )

        # Assert
        assert result.name == update_data["name"]
        assert result.description == update_data["description"]
        assert result.status == update_data["status"]
        assert "new_key" in result.integration_metadata
        assert result.integration_metadata["new_key"] == "new_value"
        mock_db.add.assert_called_once()  # Event record

    async def test_share_integration(
        self, mock_db, test_integration, test_team, test_user_id
    ):
        """Test sharing an integration with another team."""
        # Setup
        mock_db.get.return_value = test_integration

        # No existing share
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        target_team_id = uuid.uuid4()
        share_level = ShareLevel.READ_ONLY

        # Execute
        result = await IntegrationService.share_integration(
            db=mock_db,
            integration_id=test_integration.id,
            team_id=target_team_id,
            user_id=test_user_id,
            share_level=share_level,
        )

        # Assert
        assert result.integration_id == test_integration.id
        assert result.team_id == target_team_id
        assert result.shared_by_user_id == test_user_id
        assert result.share_level == share_level
        assert mock_db.add.call_count == 2  # Share and event

    async def test_revoke_integration_share(
        self, mock_db, test_integration, test_team, test_user_id
    ):
        """Test revoking an integration share."""
        # Setup
        target_team_id = uuid.uuid4()

        # Mock existing share
        mock_share = IntegrationShare(
            id=uuid.uuid4(),
            integration_id=test_integration.id,
            team_id=target_team_id,
            shared_by_user_id=test_user_id,
            share_level=ShareLevel.READ_ONLY,
            status="active",
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_share
        mock_db.execute.return_value = mock_result

        # Execute
        result = await IntegrationService.revoke_integration_share(
            db=mock_db,
            integration_id=test_integration.id,
            team_id=target_team_id,
            user_id=test_user_id,
        )

        # Assert
        assert result is True
        assert mock_share.status == "revoked"
        assert mock_share.revoked_at is not None
        mock_db.add.assert_called_once()  # Event record

    async def test_grant_resource_access(
        self, mock_db, test_integration, test_team, test_user_id
    ):
        """Test granting access to a resource."""
        # Setup
        resource_id = uuid.uuid4()
        team_id = uuid.uuid4()

        # Mock resource
        mock_resource = ServiceResource(
            id=resource_id,
            integration_id=test_integration.id,
            name="Test Resource",
            resource_type="slack_channel",
            external_id="C12345",
        )
        mock_db.get.return_value = mock_resource

        # No existing access
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Execute
        result = await IntegrationService.grant_resource_access(
            db=mock_db,
            resource_id=resource_id,
            team_id=team_id,
            user_id=test_user_id,
            access_level=AccessLevel.READ,
        )

        # Assert
        assert result.resource_id == resource_id
        assert result.team_id == team_id
        assert result.granted_by_user_id == test_user_id
        assert result.access_level == AccessLevel.READ
        assert mock_db.add.call_count == 2  # Access and event
