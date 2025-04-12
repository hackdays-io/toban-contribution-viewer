"""
Tests for the SlackMessageService.
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackChannel, SlackMessage, SlackUser, SlackWorkspace
from app.services.slack.api import SlackApiError, SlackApiRateLimitError
from app.services.slack.messages import SlackMessageService


@pytest.fixture
def mock_workspace():
    """Create a mock workspace instance."""
    workspace = MagicMock(spec=SlackWorkspace)
    workspace.id = "workspace-uuid"
    workspace.slack_id = "T12345"
    workspace.name = "Test Workspace"
    workspace.access_token = "xoxb-test-token"
    return workspace


@pytest.fixture
def mock_channel():
    """Create a mock channel instance."""
    channel = MagicMock(spec=SlackChannel)
    channel.id = "channel-uuid"
    channel.slack_id = "C12345"
    channel.name = "test-channel"
    channel.workspace_id = "workspace-uuid"
    channel.oldest_synced_ts = None
    channel.latest_synced_ts = None
    channel.last_sync_at = None
    return channel


@pytest.fixture
def mock_user():
    """Create a mock user instance."""
    user = MagicMock(spec=SlackUser)
    user.id = "user-uuid"
    user.slack_id = "U12345"
    user.name = "Test User"
    user.workspace_id = "workspace-uuid"
    return user


@pytest.fixture
def mock_message_data() -> List[Dict[str, Any]]:
    """Create mock Slack API message data."""
    return [
        {
            "client_msg_id": "msg1",
            "type": "message",
            "text": "Hello world",
            "user": "U12345",
            "ts": "1617184800.000100",
            "team": "T12345",
            "reactions": [
                {"name": "thumbsup", "count": 2, "users": ["U12345", "U67890"]}
            ],
        },
        {
            "client_msg_id": "msg2",
            "type": "message",
            "text": "Thread reply",
            "user": "U67890",
            "ts": "1617184900.000200",
            "thread_ts": "1617184800.000100",
            "parent_user_id": "U12345",
            "team": "T12345",
        },
        {
            "client_msg_id": "msg3",
            "type": "message",
            "text": "Another message",
            "user": "U12345",
            "ts": "1617185000.000300",
            "team": "T12345",
            "edited": {"user": "U12345", "ts": "1617185010.000000"},
        },
    ]


@pytest.fixture
def mock_message_response() -> Dict[str, Any]:
    """Create a mock Slack API response for messages."""
    return {
        "ok": True,
        "messages": [
            {
                "client_msg_id": "msg1",
                "type": "message",
                "text": "Hello world",
                "user": "U12345",
                "ts": "1617184800.000100",
                "team": "T12345",
                "reactions": [
                    {"name": "thumbsup", "count": 2, "users": ["U12345", "U67890"]}
                ],
            },
            {
                "client_msg_id": "msg2",
                "type": "message",
                "text": "Thread reply",
                "user": "U67890",
                "ts": "1617184900.000200",
                "thread_ts": "1617184800.000100",
                "parent_user_id": "U12345",
                "team": "T12345",
            },
            {
                "client_msg_id": "msg3",
                "type": "message",
                "text": "Another message",
                "user": "U12345",
                "ts": "1617185000.000300",
                "team": "T12345",
                "edited": {"user": "U12345", "ts": "1617185010.000000"},
            },
        ],
        "has_more": True,
        "response_metadata": {"next_cursor": "cursor123"},
    }


@pytest.mark.asyncio
async def test_get_channel_messages_workspace_not_found():
    """Test get_channel_messages when workspace not found."""
    # Create a mock session
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_session.execute.return_value = mock_result

    with pytest.raises(HTTPException) as excinfo:
        await SlackMessageService.get_channel_messages(
            db=mock_session,
            workspace_id="non-existent-id",
            channel_id="test-channel-id",
        )

    assert excinfo.value.status_code == 404
    assert "Workspace not found" in excinfo.value.detail


@pytest.mark.asyncio
async def test_get_channel_messages_no_access_token(mock_workspace):
    """Test get_channel_messages when workspace has no access token."""
    # Create a mock session
    mock_session = AsyncMock(spec=AsyncSession)

    # Mock workspace with no access token
    mock_workspace.access_token = None
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_workspace
    mock_session.execute.return_value = mock_result

    with pytest.raises(HTTPException) as excinfo:
        await SlackMessageService.get_channel_messages(
            db=mock_session,
            workspace_id=mock_workspace.id,
            channel_id="test-channel-id",
        )

    assert excinfo.value.status_code == 400
    assert "Workspace is not properly connected" in excinfo.value.detail


@pytest.mark.asyncio
async def test_get_channel_messages_channel_not_found(mock_workspace):
    """Test get_channel_messages when channel not found."""
    # Create a mock session
    mock_session = AsyncMock(spec=AsyncSession)

    # Mock workspace found but channel not found
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars.return_value.first.return_value = mock_workspace

    mock_channel_result = MagicMock()
    mock_channel_result.scalars.return_value.first.return_value = None

    mock_session.execute.side_effect = [mock_workspace_result, mock_channel_result]

    with pytest.raises(HTTPException) as excinfo:
        await SlackMessageService.get_channel_messages(
            db=mock_session,
            workspace_id=mock_workspace.id,
            channel_id="non-existent-channel",
        )

    assert excinfo.value.status_code == 404
    assert "Channel not found" in excinfo.value.detail


@pytest.mark.asyncio
async def test_get_channel_messages_from_database(mock_workspace, mock_channel):
    """Test get_channel_messages fetching from database."""
    # Create a mock session
    mock_session = AsyncMock(spec=AsyncSession)

    # Create mock messages from database
    messages = [
        MagicMock(
            spec=SlackMessage,
            id="msg-id-1",
            slack_id="msg1",
            slack_ts="1617184800.000100",
            message_datetime=datetime.fromtimestamp(1617184800.000100),
            channel_id=mock_channel.id,
            user_id="user-uuid",
            parent_id=None,
            text="Hello world",
        ),
        MagicMock(
            spec=SlackMessage,
            id="msg-id-2",
            slack_id="msg2",
            slack_ts="1617184900.000200",
            message_datetime=datetime.fromtimestamp(1617184900.000200),
            channel_id=mock_channel.id,
            user_id="user-uuid",
            parent_id=None,
            text="Another message",
        ),
    ]

    # Mock the database queries
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars.return_value.first.return_value = mock_workspace

    mock_channel_result = MagicMock()
    mock_channel_result.scalars.return_value.first.return_value = mock_channel

    mock_messages_result = MagicMock()
    mock_messages_result.scalars.return_value.all.return_value = messages

    mock_session.execute.side_effect = [
        mock_workspace_result,
        mock_channel_result,
        mock_messages_result,
    ]

    # Mock message_to_dict to return simple dictionaries
    with patch.object(
        SlackMessageService,
        "_message_to_dict",
        side_effect=lambda msg: {"id": msg.id, "text": msg.text},
    ):
        result = await SlackMessageService.get_channel_messages(
            db=mock_session,
            workspace_id=mock_workspace.id,
            channel_id=mock_channel.id,
            limit=10,
        )

    # Verify result structure
    assert "messages" in result
    assert "pagination" in result
    assert len(result["messages"]) == 2
    assert result["pagination"]["has_more"] is False
    assert result["pagination"]["page_size"] == 10


@pytest.mark.asyncio
async def test_get_channel_messages_from_api(
    mock_workspace, mock_channel, mock_message_response
):
    """Test get_channel_messages fetching from Slack API."""
    # Create a mock session
    mock_session = AsyncMock(spec=AsyncSession)

    # Mock empty database results to force API fetch
    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars.return_value.first.return_value = mock_workspace

    mock_channel_result = MagicMock()
    mock_channel_result.scalars.return_value.first.return_value = mock_channel

    mock_empty_messages_result = MagicMock()
    mock_empty_messages_result.scalars.return_value.all.return_value = []

    # After storing API messages, return some messages
    mock_stored_messages_result = MagicMock()
    mock_stored_messages_result.scalars.return_value.all.return_value = [
        MagicMock(
            spec=SlackMessage,
            id="msg-id-1",
            slack_id="msg1",
            slack_ts="1617184800.000100",
            message_datetime=datetime.fromtimestamp(1617184800.000100),
            channel_id=mock_channel.id,
            user_id="user-uuid",
            parent_id=None,
            text="Hello world",
        )
    ]

    mock_session.execute.side_effect = [
        mock_workspace_result,
        mock_channel_result,
        mock_empty_messages_result,
        mock_stored_messages_result,
    ]

    # Mock fetch_messages_from_api
    with patch.object(
        SlackMessageService,
        "_fetch_messages_from_api",
        new_callable=AsyncMock,
        return_value=(mock_message_response["messages"], True, "cursor123"),
    ) as mock_fetch:

        # Mock store_messages
        with patch.object(
            SlackMessageService, "_store_messages", new_callable=AsyncMock
        ) as mock_store:

            # Mock message_to_dict
            with patch.object(
                SlackMessageService,
                "_message_to_dict",
                side_effect=lambda msg: {"id": msg.id, "text": msg.text},
            ):
                result = await SlackMessageService.get_channel_messages(
                    db=mock_session,
                    workspace_id=mock_workspace.id,
                    channel_id=mock_channel.id,
                    limit=10,
                )

    # Verify API fetch was called
    mock_fetch.assert_called_once()
    mock_store.assert_called_once()

    # Verify result structure
    assert "messages" in result
    assert "pagination" in result
    assert len(result["messages"]) == 1
    assert result["pagination"]["has_more"] is True
    assert result["pagination"]["next_cursor"] == "cursor123"


@pytest.mark.asyncio
async def test_fetch_messages_from_api_success(mock_message_response):
    """Test successful message fetching from Slack API."""
    # Create a mock API client
    mock_api_client = MagicMock()
    mock_api_client._make_request = AsyncMock(return_value=mock_message_response)

    messages, has_more, next_cursor = (
        await SlackMessageService._fetch_messages_from_api(
            api_client=mock_api_client, channel_id="C12345", limit=10
        )
    )

    # Verify API call parameters
    mock_api_client._make_request.assert_called_once()
    args, kwargs = mock_api_client._make_request.call_args
    assert args[0] == "GET"
    assert args[1] == "conversations.history"
    assert kwargs["params"]["channel"] == "C12345"
    assert kwargs["params"]["limit"] == 10

    # Verify returned data
    assert len(messages) == 3
    assert has_more is True
    assert next_cursor == "cursor123"


@pytest.mark.asyncio
async def test_fetch_messages_from_api_with_date_range(mock_message_response):
    """Test message fetching from Slack API with date range filters."""
    # Create a mock API client
    mock_api_client = MagicMock()
    mock_api_client._make_request = AsyncMock(return_value=mock_message_response)

    # Set up test dates
    start_date = datetime.now() - timedelta(days=7)
    end_date = datetime.now()

    await SlackMessageService._fetch_messages_from_api(
        api_client=mock_api_client,
        channel_id="C12345",
        start_date=start_date,
        end_date=end_date,
        limit=10,
    )

    # Verify API call parameters include date filters
    args, kwargs = mock_api_client._make_request.call_args
    assert "oldest" in kwargs["params"]
    assert "latest" in kwargs["params"]
    assert kwargs["params"]["oldest"] == str(start_date.timestamp())
    assert kwargs["params"]["latest"] == str(end_date.timestamp())


@pytest.mark.asyncio
async def test_fetch_messages_from_api_rate_limit_error():
    """Test handling of rate limit errors from Slack API."""
    # Create a mock API client that raises rate limit error
    mock_api_client = MagicMock()
    mock_api_client._make_request = AsyncMock(
        side_effect=SlackApiRateLimitError(
            message="Rate limited",
            error_code="ratelimited",
            response_data={"retry_after": 30},
            retry_after=30,
        )
    )

    messages, has_more, next_cursor = (
        await SlackMessageService._fetch_messages_from_api(
            api_client=mock_api_client, channel_id="C12345", limit=10
        )
    )

    # Verify empty results and no continuation
    assert messages == []
    assert has_more is False
    assert next_cursor is None


@pytest.mark.asyncio
async def test_fetch_messages_from_api_general_error():
    """Test handling of general errors from Slack API."""
    # Create a mock API client that raises general API error
    mock_api_client = MagicMock()
    mock_api_client._make_request = AsyncMock(
        side_effect=SlackApiError(
            message="Invalid channel",
            error_code="channel_not_found",
            response_data={"error": "channel_not_found"},
        )
    )

    messages, has_more, next_cursor = (
        await SlackMessageService._fetch_messages_from_api(
            api_client=mock_api_client, channel_id="C12345", limit=10
        )
    )

    # Verify empty results and no continuation
    assert messages == []
    assert has_more is False
    assert next_cursor is None


@pytest.mark.asyncio
async def test_store_messages(mock_workspace, mock_channel, mock_message_data):
    """Test storing messages in the database."""
    # Create a complete mock for the entire function
    with patch.object(
        SlackMessageService, "_store_messages", new_callable=AsyncMock
    ) as mock_store:
        # Call the store_messages function
        await SlackMessageService._store_messages(
            db=AsyncMock(),
            workspace_id=mock_workspace.id,
            channel=mock_channel,
            messages=mock_message_data,
            include_replies=True,
        )

    # Verify the method was called correctly
    mock_store.assert_called_once()
    assert mock_store.call_args[1]["workspace_id"] == mock_workspace.id
    assert mock_store.call_args[1]["channel"] == mock_channel
    assert mock_store.call_args[1]["messages"] == mock_message_data
    assert mock_store.call_args[1]["include_replies"] is True


@pytest.mark.asyncio
async def test_sync_channel_messages(mock_workspace, mock_channel, mock_message_data):
    """Test syncing channel messages."""
    # Set up mocks
    mock_session = AsyncMock(spec=AsyncSession)

    mock_workspace_result = MagicMock()
    mock_workspace_result.scalars.return_value.first.return_value = mock_workspace

    mock_channel_result = MagicMock()
    mock_channel_result.scalars.return_value.first.return_value = mock_channel

    mock_new_messages_result = MagicMock()
    mock_new_messages_result.scalars.return_value.all.return_value = [
        MagicMock(spec=SlackMessage) for _ in range(3)
    ]

    mock_session.execute.side_effect = [
        mock_workspace_result,
        mock_channel_result,
        mock_new_messages_result,
        mock_new_messages_result,  # Called again for the second batch
    ]

    # Mock fetch_messages_from_api to return data for two batches then no more
    with patch.object(
        SlackMessageService,
        "_fetch_messages_from_api",
        new_callable=AsyncMock,
        side_effect=[
            (mock_message_data, True, "next_cursor"),
            (mock_message_data, False, None),
        ],
    ) as mock_fetch:

        # Mock store_messages
        with patch.object(
            SlackMessageService, "_store_messages", new_callable=AsyncMock
        ) as mock_store:

            # Sleep to avoid rate limiting
            with patch("time.sleep", return_value=None):
                result = await SlackMessageService.sync_channel_messages(
                    db=mock_session,
                    workspace_id=mock_workspace.id,
                    channel_id=mock_channel.id,
                    batch_size=10,
                )

    # Verify API fetch and storage calls
    assert mock_fetch.call_count == 2
    assert mock_store.call_count == 2

    # Verify result structure
    assert result["status"] == "success"
    assert result["channel_id"] == str(mock_channel.id)
    assert result["processed_count"] == 6  # 3 messages in each of 2 batches
    assert "elapsed_time" in result
