"""
Tests for Slack channels service.
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackChannel, SlackWorkspace
from app.services.slack.api import SlackApiClient
from app.services.slack.channels import ChannelService


@pytest.fixture
def mock_db_session():
    """Mock database session for testing."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_workspace():
    """Create a mock SlackWorkspace instance."""
    return SlackWorkspace(
        id=uuid.uuid4(),
        slack_id="T12345",
        name="Test Workspace",
        domain="testworkspace",
        access_token="xoxb-test-token",
        is_connected=True,
        connection_status="active",
        last_connected_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_channel():
    """Create a mock SlackChannel instance."""
    return SlackChannel(
        id=uuid.uuid4(),
        slack_id="C12345",
        name="general",
        type="public",
        purpose="Company-wide announcements",
        topic="Important stuff",
        member_count=10,
        is_archived=False,
        is_bot_member=True,
        is_selected_for_analysis=False,
        is_supported=True,
        workspace_id=uuid.uuid4(),
    )


@pytest.mark.asyncio
async def test_get_channels_for_workspace(
    mock_db_session, mock_workspace, mock_channel
):
    """Test getting channels for a workspace."""
    # Mock the select result for workspace query
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars = MagicMock()
    mock_workspace_result.scalars.return_value = MagicMock()
    mock_workspace_result.scalars.return_value.first = MagicMock(
        return_value=mock_workspace
    )

    # Mock the channel list result
    mock_channels_result = MagicMock()
    mock_channels_result.scalars = MagicMock()
    mock_channels_result.scalars.return_value = MagicMock()
    mock_channels_result.scalars.return_value.all = MagicMock(
        return_value=[mock_channel]
    )

    # Mock the count result
    mock_count_result = MagicMock()
    mock_count_result.scalars = MagicMock()
    mock_count_result.scalars.return_value = MagicMock()
    mock_count_result.scalars.return_value.all = MagicMock(return_value=[mock_channel])

    # Set up the db.execute mock to return different results for different queries
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.side_effect = [
        mock_workspace_result,  # First call (workspace query)
        mock_channels_result,  # Second call (channel list query)
        mock_count_result,  # Third call (count query)
    ]

    # Call the service method
    result = await ChannelService.get_channels_for_workspace(
        db=mock_db_session,
        workspace_id=str(mock_workspace.id),
        channel_types=["public"],
        include_archived=False,
        page=1,
        page_size=100,
    )

    # Verify the result
    assert "channels" in result
    assert len(result["channels"]) == 1
    assert result["channels"][0]["slack_id"] == mock_channel.slack_id
    assert result["channels"][0]["name"] == mock_channel.name
    assert "pagination" in result
    assert result["pagination"]["total_items"] == 1
    assert result["pagination"]["page"] == 1

    # Verify the db calls got executed
    # Note: The exact call count might vary based on implementation details
    assert mock_db_session.execute.call_count >= 3


@pytest.mark.asyncio
async def test_get_channels_workspace_not_found(mock_db_session):
    """Test error handling when workspace is not found."""
    # Mock the select result to return None
    mock_execute_result = MagicMock()
    mock_execute_result.scalars = MagicMock()
    mock_execute_result.scalars.return_value = MagicMock()
    mock_execute_result.scalars.return_value.first = MagicMock(return_value=None)

    mock_db_session.execute = AsyncMock(return_value=mock_execute_result)

    # Try to call the service method
    with pytest.raises(HTTPException) as exc_info:
        await ChannelService.get_channels_for_workspace(
            db=mock_db_session,
            workspace_id=str(uuid.uuid4()),
        )

    # Verify exception
    assert exc_info.value.status_code == 404
    assert "Workspace not found" in exc_info.value.detail


@pytest.mark.asyncio
async def test_sync_channels_from_slack(mock_db_session, mock_workspace):
    """Test syncing channels from Slack API."""
    # Mock the workspace query
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars = MagicMock()
    mock_workspace_result.scalars.return_value = MagicMock()
    mock_workspace_result.scalars.return_value.first = MagicMock(
        return_value=mock_workspace
    )

    # Mock channel queries
    mock_channel_result = MagicMock()
    mock_channel_result.scalars = MagicMock()
    mock_channel_result.scalars.return_value = MagicMock()
    mock_channel_result.scalars.return_value.first = MagicMock(
        return_value=None
    )  # No existing channels

    # Set up the db.execute mock
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.side_effect = [
        mock_workspace_result,  # First call (workspace query)
        mock_channel_result,  # Channel existence check
    ]

    # Mock the SlackApiClient
    with patch("app.services.slack.channels.SlackApiClient") as mock_client_class:
        mock_client = MagicMock(spec=SlackApiClient)

        # Mock the async methods
        mock_client.get_channels = AsyncMock(
            return_value={
                "channels": [
                    {
                        "id": "C12345",
                        "name": "general",
                        "is_channel": True,
                        "is_archived": False,
                        "purpose": {"value": "Company-wide announcements"},
                        "topic": {"value": "Important stuff"},
                        "num_members": 10,
                        "created": "1234567890",
                        "is_member": True,
                    },
                ],
                "response_metadata": {"next_cursor": ""},  # No more pages
            }
        )

        # Mock bot membership check
        mock_client.check_bot_in_channel = AsyncMock(return_value=True)

        mock_client_class.return_value = mock_client

        # Mock db operations
        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock()

        # Call the service method
        created, updated, total = await ChannelService.sync_channels_from_slack(
            db=mock_db_session,
            workspace_id=str(mock_workspace.id),
        )

        # Verify the results
        assert created == 1  # One channel created
        assert updated == 0  # No channels updated
        assert total == 1  # Total channels processed

        # Verify API client calls
        assert mock_client.get_channels.called

        # Verify db operations
        assert mock_db_session.add.called
        assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_select_channels_for_analysis_without_bot_install(
    mock_db_session, mock_workspace, mock_channel
):
    """Test selecting channels for analysis without bot installation."""
    # Mock the workspace query
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars = MagicMock()
    mock_workspace_result.scalars.return_value = MagicMock()
    mock_workspace_result.scalars.return_value.first = MagicMock(
        return_value=mock_workspace
    )

    # Mock update results
    mock_update_result1 = MagicMock()
    mock_update_result2 = MagicMock()

    # Mock the selected channels query
    selected_channel = mock_channel
    selected_channel.is_selected_for_analysis = True
    mock_selected_result = MagicMock()
    mock_selected_result.scalars = MagicMock()
    mock_selected_result.scalars.return_value = MagicMock()
    mock_selected_result.scalars.return_value.all = MagicMock(
        return_value=[selected_channel]
    )

    # Set up the db.execute mock
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.side_effect = [
        mock_workspace_result,  # First call (workspace query)
        mock_update_result1,  # Second call (update unselect all)
        mock_update_result2,  # Third call (update select specific)
        mock_selected_result,  # Fourth call (get selected count)
    ]

    # Mock db commit
    mock_db_session.commit = AsyncMock()

    # Call the service method with install_bot=False
    result = await ChannelService.select_channels_for_analysis(
        db=mock_db_session,
        workspace_id=str(mock_workspace.id),
        channel_ids=[str(mock_channel.id)],
        install_bot=False,
    )

    # Verify the result
    assert result["status"] == "success"
    assert result["selected_count"] == 1
    assert len(result["selected_channels"]) == 1
    assert result["selected_channels"][0]["id"] == str(mock_channel.id)
    assert "bot_installation" not in result

    # Verify the db operations
    assert mock_db_session.execute.call_count == 4
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_select_channels_for_analysis_with_bot_install(
    mock_db_session, mock_workspace, mock_channel
):
    """Test selecting channels for analysis with bot installation."""
    # Mock the workspace query
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars = MagicMock()
    mock_workspace_result.scalars.return_value = MagicMock()
    mock_workspace_result.scalars.return_value.first = MagicMock(
        return_value=mock_workspace
    )

    # Mock update results
    mock_update_result1 = MagicMock()
    mock_update_result2 = MagicMock()

    # Mock the selected channels query - make a copy of mock_channel that isn't a bot member
    channel_without_bot = SlackChannel(
        id=uuid.uuid4(),
        slack_id="C67890",
        name="without-bot",
        type="public",
        purpose="Testing channel",
        topic="Testing stuff",
        member_count=5,
        is_archived=False,
        is_bot_member=False,
        is_selected_for_analysis=True,
        is_supported=True,
        workspace_id=mock_workspace.id,
    )

    # Both channels are selected for analysis
    mock_channel.is_selected_for_analysis = True
    mock_selected_result = MagicMock()
    mock_selected_result.scalars = MagicMock()
    mock_selected_result.scalars.return_value = MagicMock()
    mock_selected_result.scalars.return_value.all = MagicMock(
        return_value=[mock_channel, channel_without_bot]
    )

    # Set up the db.execute mock
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.side_effect = [
        mock_workspace_result,  # First call (workspace query)
        mock_update_result1,  # Second call (update unselect all)
        mock_update_result2,  # Third call (update select specific)
        mock_selected_result,  # Fourth call (get selected count)
    ]

    # Mock db commit
    mock_db_session.commit = AsyncMock()

    # Mock SlackApiClient for join_channel
    with patch("app.services.slack.channels.SlackApiClient") as mock_client_class:
        mock_client = AsyncMock(spec=SlackApiClient)

        # Mock join_channel to succeed
        mock_client.join_channel = AsyncMock(
            return_value={"ok": True, "channel": {"id": "C67890"}}
        )

        mock_client_class.return_value = mock_client

        # Call the service method with install_bot=True
        result = await ChannelService.select_channels_for_analysis(
            db=mock_db_session,
            workspace_id=str(mock_workspace.id),
            channel_ids=[str(mock_channel.id), str(channel_without_bot.id)],
            install_bot=True,
        )

        # Verify the result
        assert result["status"] == "success"
        assert result["selected_count"] == 2
        assert len(result["selected_channels"]) == 2

        # Verify bot installation was attempted on the channel without bot
        assert "bot_installation" in result
        assert result["bot_installation"]["attempted_count"] == 1
        assert len(result["bot_installation"]["results"]) == 1
        assert result["bot_installation"]["results"][0]["status"] == "success"

        # Verify the bot is now a member of the channel
        assert channel_without_bot.is_bot_member is True

        # Verify the API client was called
        mock_client.join_channel.assert_called_once_with(channel_without_bot.slack_id)

        # Verify the db operations
        assert mock_db_session.execute.call_count == 4
        assert mock_db_session.commit.called
