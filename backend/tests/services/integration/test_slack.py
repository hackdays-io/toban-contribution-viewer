"""
Tests for the Slack integration service.
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import (
    Integration,
    IntegrationStatus,
    IntegrationType,
)
from app.models.team import Team
from app.services.integration.slack import SlackIntegrationService


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
        metadata={"slack_id": "T12345"},
        owner_team_id=test_team.id,
        created_by_user_id="user123",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_slack_api():
    """Mock SlackAPI instance."""
    mock = MagicMock()
    mock.exchange_code = AsyncMock()
    mock.get_workspace_info = AsyncMock()
    mock.get_all_channels = AsyncMock()
    mock.get_all_users = AsyncMock()
    return mock


class TestSlackIntegrationService:
    """Tests for the SlackIntegrationService class."""

    @patch("app.services.integration.slack.SlackAPI")
    async def test_create_from_oauth(
        self, mock_slack_api_class, mock_db, test_team, test_user_id
    ):
        """Test creating a Slack integration from OAuth."""
        # Setup
        mock_api = mock_slack_api_class.return_value

        # Mock OAuth exchange response
        oauth_response = {
            "access_token": "xoxb-token",
            "bot_user_id": "U12345",
            "scope": "channels:read,users:read",
            "expires_in": 86400,
        }
        mock_api.exchange_code.return_value = oauth_response

        # Mock workspace info response
        workspace_info = {
            "team": {
                "id": "T12345",
                "name": "Test Workspace",
                "domain": "test",
                "icon": {"image_132": "https://example.com/icon.png"},
            }
        }
        mock_api.get_workspace_info.return_value = workspace_info

        # Mock channel and user sync methods
        with patch.object(
            SlackIntegrationService, "sync_channels", AsyncMock()
        ) as mock_sync_channels, patch.object(
            SlackIntegrationService, "sync_users", AsyncMock()
        ) as mock_sync_users:
            # Execute
            integration, info = await SlackIntegrationService.create_from_oauth(
                db=mock_db,
                team_id=test_team.id,
                user_id=test_user_id,
                auth_code="test_code",
                redirect_uri="https://example.com/callback",
                client_id="client_id",
                client_secret="client_secret",
            )

            # Assert
            assert integration.name == "Test Workspace Slack"
            assert integration.service_type == IntegrationType.SLACK
            assert integration.owner_team_id == test_team.id
            assert integration.metadata["slack_id"] == "T12345"
            assert integration.metadata["name"] == "Test Workspace"
            assert mock_db.add.call_count >= 2  # Integration and credential at minimum
            assert mock_api.exchange_code.called
            assert mock_api.get_workspace_info.called
            assert mock_sync_channels.called
            assert mock_sync_users.called

    @patch("app.services.integration.slack.SlackAPI")
    async def test_sync_channels(self, mock_slack_api_class, mock_db, test_integration):
        """Test syncing Slack channels."""
        # Setup
        mock_api = mock_slack_api_class.return_value

        # Mock get_token method
        with patch.object(
            SlackIntegrationService, "get_token", AsyncMock(return_value="xoxb-token")
        ):
            # Mock API response for channels
            mock_channels = [
                {
                    "id": "C12345",
                    "name": "general",
                    "is_private": False,
                    "purpose": {"value": "General discussions"},
                    "topic": {"value": "Company-wide announcements"},
                    "num_members": 50,
                    "is_archived": False,
                    "created": 1600000000,
                },
                {
                    "id": "C67890",
                    "name": "random",
                    "is_private": False,
                    "purpose": {"value": "Random stuff"},
                    "topic": {"value": "Fun and games"},
                    "num_members": 45,
                    "is_archived": False,
                    "created": 1600000100,
                },
            ]
            mock_api.get_all_channels.return_value = mock_channels

            # Mock existing resources query
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db.execute.return_value = mock_result

            # Mock get integration
            mock_db.get.return_value = test_integration

            # Execute
            result = await SlackIntegrationService.sync_channels(
                db=mock_db, integration_id=test_integration.id
            )

            # Assert
            assert len(result) == 2
            assert mock_db.add.call_count == 2  # Two new channel resources
            assert mock_api.get_all_channels.called

    @patch("app.services.integration.slack.SlackAPI")
    async def test_sync_users(self, mock_slack_api_class, mock_db, test_integration):
        """Test syncing Slack users."""
        # Setup
        mock_api = mock_slack_api_class.return_value

        # Mock get_token method
        with patch.object(
            SlackIntegrationService, "get_token", AsyncMock(return_value="xoxb-token")
        ):
            # Mock API response for users
            mock_users = [
                {
                    "id": "U12345",
                    "name": "johndoe",
                    "is_bot": False,
                    "is_admin": True,
                    "deleted": False,
                    "profile": {
                        "real_name": "John Doe",
                        "display_name": "John",
                        "email": "john@example.com",
                        "title": "Developer",
                        "phone": "123-456-7890",
                        "image_24": "https://example.com/image24.png",
                        "image_48": "https://example.com/image48.png",
                        "image_72": "https://example.com/image72.png",
                    },
                },
                {
                    "id": "U67890",
                    "name": "janesmith",
                    "is_bot": False,
                    "is_admin": False,
                    "deleted": False,
                    "profile": {
                        "real_name": "Jane Smith",
                        "display_name": "Jane",
                        "email": "jane@example.com",
                        "title": "Designer",
                        "phone": "987-654-3210",
                        "image_24": "https://example.com/jane24.png",
                        "image_48": "https://example.com/jane48.png",
                        "image_72": "https://example.com/jane72.png",
                    },
                },
                {
                    "id": "B12345",
                    "name": "slackbot",
                    "is_bot": True,  # Should be skipped
                    "deleted": False,
                    "profile": {
                        "real_name": "Slackbot",
                        "display_name": "Slackbot",
                    },
                },
            ]
            mock_api.get_all_users.return_value = mock_users

            # Mock existing resources query
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db.execute.return_value = mock_result

            # Mock get integration
            mock_db.get.return_value = test_integration

            # Execute
            result = await SlackIntegrationService.sync_users(
                db=mock_db, integration_id=test_integration.id
            )

            # Assert
            assert len(result) == 2  # Two users, bot is skipped
            assert mock_db.add.call_count == 2
            assert mock_api.get_all_users.called
