"""
Tests for the Slack messages API endpoints.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.slack.messages import router as messages_router
from app.models.slack import SlackChannel, SlackMessage, SlackWorkspace


@pytest.fixture
def mock_slack_message_service():
    """Create a mock for the SlackMessageService."""
    with patch("app.api.v1.slack.messages.SlackMessageService") as mock:
        yield mock


@pytest.fixture
def app(mock_slack_message_service) -> FastAPI:
    """Create a FastAPI test app with our router."""
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(messages_router, prefix="/api/v1/slack")
    return app


@pytest.fixture
def client(app) -> TestClient:
    """Create a test client for the app."""
    return TestClient(app)


@pytest.fixture
def mock_uuid():
    """Generate consistent UUIDs for testing."""
    return str(uuid.uuid4())


@pytest.fixture
def mock_channel_id(mock_uuid):
    """Create a mock channel ID."""
    return mock_uuid


@pytest.fixture
def mock_workspace_id(mock_uuid):
    """Create a mock workspace ID."""
    return mock_uuid


@pytest.fixture
def mock_message_response() -> Dict:
    """Create a mock message response."""
    return {
        "messages": [
            {
                "id": str(uuid.uuid4()),
                "slack_id": "message123",
                "slack_ts": "1612345678.123456",
                "text": "Hello, world!",
                "message_type": "message",
                "subtype": None,
                "is_edited": False,
                "edited_ts": None,
                "has_attachments": False,
                "thread_ts": None,
                "is_thread_parent": False,
                "is_thread_reply": False,
                "reply_count": 0,
                "reply_users_count": 0,
                "reaction_count": 0,
                "message_datetime": datetime.now().isoformat(),
                "channel_id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
                "parent_id": None,
            }
        ],
        "pagination": {
            "has_more": False,
            "next_cursor": None,
            "page_size": 100,
            "total_messages": 1,
        },
    }


def test_get_channel_messages(
    app: FastAPI,
    mock_slack_message_service,
    mock_workspace_id,
    mock_channel_id,
    mock_message_response,
    client: TestClient,
):
    """Test the get_channel_messages endpoint."""
    # Configure the mock
    mock_slack_message_service.get_channel_messages.return_value = mock_message_response

    # Make the request
    response = client.get(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/messages",
        params={
            "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
            "end_date": datetime.now().isoformat(),
            "include_replies": "true",
            "limit": "100",
        },
    )

    # Assert the response
    assert response.status_code == 200
    response_data = response.json()
    assert "messages" in response_data
    assert "pagination" in response_data
    assert len(response_data["messages"]) == 1

    # Verify the mock was called with the expected parameters
    mock_slack_message_service.get_channel_messages.assert_called_once()


def test_get_messages_by_date_range(
    app: FastAPI,
    mock_slack_message_service,
    mock_workspace_id,
    mock_message_response,
    client: TestClient,
):
    """Test the get_messages_by_date_range endpoint."""
    # Configure the mock
    mock_slack_message_service.get_messages_by_date_range.return_value = (
        mock_message_response
    )

    # Make the request
    response = client.get(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/messages",
        params={
            "channel_ids": str(uuid.uuid4()),  # Pass a single ID to simplify the test
            "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
            "end_date": datetime.now().isoformat(),
            "page": "1",
            "page_size": "100",
        },
    )

    # Assert the response
    assert response.status_code == 200
    response_data = response.json()
    assert "messages" in response_data
    assert "pagination" in response_data

    # Verify the mock was called with the expected parameters
    mock_slack_message_service.get_messages_by_date_range.assert_called_once()


def test_sync_channel_messages(
    app: FastAPI,
    mock_slack_message_service,
    mock_workspace_id,
    mock_channel_id,
    client: TestClient,
):
    """Test the sync_channel_messages endpoint."""
    # Make the request
    date_range = {
        "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
        "end_date": datetime.now().isoformat(),
        "include_replies": True,
    }

    response = client.post(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/sync",
        json=date_range,
        params={"batch_size": "200", "include_replies": "true"},
    )

    # Assert the response
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "syncing"
    assert "message" in response_data
    assert response_data["workspace_id"] == mock_workspace_id
    assert response_data["channel_id"] == mock_channel_id
