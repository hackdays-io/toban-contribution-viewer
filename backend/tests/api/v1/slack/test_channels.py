"""
Tests for Slack channels API.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.slack.channels import router as channels_router
from app.models.slack import SlackChannel, SlackWorkspace


@pytest.fixture
def mock_workspace():
    """Fixture for a mock workspace."""
    return SlackWorkspace(
        id=uuid.uuid4(),
        slack_id="T12345",
        name="Test Workspace",
        domain="test",
        access_token="xoxb-test-token",
        is_connected=True,
        connection_status="active",
    )


@pytest.fixture
def mock_channels():
    """Fixture for mock channels."""
    return [
        SlackChannel(
            id=uuid.uuid4(),
            slack_id="C12345",
            name="general",
            type="public",
            purpose="Company-wide announcements",
            member_count=10,
            is_bot_member=True,
            is_archived=False,
            is_selected_for_analysis=False,
        ),
        SlackChannel(
            id=uuid.uuid4(),
            slack_id="C67890",
            name="random",
            type="public",
            purpose="Random stuff",
            member_count=8,
            is_bot_member=True,
            is_archived=False,
            is_selected_for_analysis=True,
        ),
        SlackChannel(
            id=uuid.uuid4(),
            slack_id="G12345",
            name="private-channel",
            type="private",
            purpose="Private discussions",
            member_count=5,
            is_bot_member=False,
            is_archived=False,
            is_selected_for_analysis=False,
        ),
    ]


def test_list_channels(mock_workspace, mock_channels):
    """Test listing channels for a workspace."""
    app = FastAPI()
    # The channels_router already has the /workspaces/{workspace_id} pattern
    app.include_router(channels_router, prefix="")

    # Create a test client
    client = TestClient(app)

    # Mock the database session
    with patch("app.api.v1.slack.channels.get_async_db") as mock_get_db:
        # Create a mock session
        mock_session = MagicMock(spec=AsyncSession)

        # Configure mock_get_db to be an async generator
        async def mock_get_db_impl():
            yield mock_session

        mock_get_db.return_value = mock_get_db_impl()

        # Mock ChannelService.get_channels_for_workspace
        with patch(
            "app.api.v1.slack.channels.ChannelService.get_channels_for_workspace"
        ) as mock_get_channels:
            # Set up the mock to return some test data
            mock_get_channels.return_value = {
                "channels": [
                    {
                        "id": str(channel.id),
                        "slack_id": channel.slack_id,
                        "name": channel.name,
                        "type": channel.type,
                        "purpose": channel.purpose,
                        "topic": None,
                        "member_count": channel.member_count,
                        "is_archived": channel.is_archived,
                        "is_bot_member": channel.is_bot_member,
                        "is_selected_for_analysis": channel.is_selected_for_analysis,
                        "is_supported": True,
                        "last_sync_at": None,
                    }
                    for channel in mock_channels
                ],
                "pagination": {
                    "page": 1,
                    "page_size": 100,
                    "total_items": len(mock_channels),
                    "total_pages": 1,
                },
            }

            # Make the request
            response = client.get(
                f"/workspaces/{mock_workspace.id}/channels",
                params={
                    "types": ["public", "private"],
                    "page": "1",
                    "page_size": "100",
                },
            )

            # Verify the response
            assert response.status_code == 200
            data = response.json()
            assert "channels" in data
            assert len(data["channels"]) == len(mock_channels)
            assert "pagination" in data
            assert data["pagination"]["page"] == 1

            # Verify the service was called with correct parameters
            mock_get_channels.assert_called_once()


def test_sync_channels():
    """Test syncing channels from Slack API."""
    app = FastAPI()
    # The channels_router already has the /workspaces/{workspace_id} pattern
    app.include_router(channels_router, prefix="")

    # Create a test client
    client = TestClient(app)

    # Mock the database session
    with patch("app.api.v1.slack.channels.get_async_db") as mock_get_db:
        # Create a mock session
        mock_session = MagicMock(spec=AsyncSession)

        # Configure mock_get_db to be an async generator
        async def mock_get_db_impl():
            yield mock_session

        mock_get_db.return_value = mock_get_db_impl()

        # Mock ChannelService.sync_channels_from_slack
        with patch(
            "app.api.v1.slack.channels.ChannelService.sync_channels_from_slack"
        ) as mock_sync:
            # Set up the mock to return some test data
            mock_sync.return_value = (5, 10, 15)  # created, updated, total

            workspace_id = str(uuid.uuid4())

            # Make the request
            response = client.post(
                f"/workspaces/{workspace_id}/channels/sync",
                params={"limit": 100, "sync_all_pages": "1"},
            )

            # Verify the response
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["created_count"] == 5
            assert data["updated_count"] == 10
            assert data["total_count"] == 15

            # Verify the service was called
            mock_sync.assert_called_once()


def test_select_channels_for_analysis(mock_workspace, mock_channels):
    """Test selecting channels for analysis."""
    app = FastAPI()
    # The channels_router already has the /workspaces/{workspace_id} pattern
    app.include_router(channels_router, prefix="")

    # Create a test client
    client = TestClient(app)

    # Mock the database session
    with patch("app.api.v1.slack.channels.get_async_db") as mock_get_db:
        # Create a mock session
        mock_session = MagicMock(spec=AsyncSession)

        # Configure mock_get_db to be an async generator
        async def mock_get_db_impl():
            yield mock_session

        mock_get_db.return_value = mock_get_db_impl()

        # Mock ChannelService.select_channels_for_analysis
        with patch(
            "app.api.v1.slack.channels.ChannelService.select_channels_for_analysis"
        ) as mock_select:
            # Set up the mock to return some test data
            selected_channels = [mock_channels[1]]  # Only the 'random' channel
            mock_select.return_value = {
                "status": "success",
                "message": "Selected 1 channels for analysis",
                "selected_count": 1,
                "selected_channels": [
                    {
                        "id": str(channel.id),
                        "name": channel.name,
                        "type": channel.type,
                        "is_bot_member": channel.is_bot_member,
                    }
                    for channel in selected_channels
                ],
            }

            # Make the request
            response = client.post(
                f"/workspaces/{mock_workspace.id}/channels/select",
                json={"channel_ids": [str(mock_channels[1].id)]},
            )

            # Verify the response
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["selected_count"] == 1
            assert len(data["selected_channels"]) == 1
            assert data["selected_channels"][0]["name"] == "random"

            # Verify the service was called
            mock_select.assert_called_once()
