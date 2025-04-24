"""
Tests for the Slack channel analysis API endpoints.
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.slack.analysis import router as analysis_router
from app.models.slack import SlackChannel, SlackMessage, SlackUser
from app.services.llm.openrouter import OpenRouterService


@pytest.fixture
def mock_openrouter_service():
    """Create a mock for the OpenRouterService."""
    with patch("app.api.v1.slack.analysis.OpenRouterService") as mock_class:
        # Create an instance mock
        instance = MagicMock(spec=OpenRouterService)
        mock_class.return_value = instance

        # Setup the analyze_channel_messages method as AsyncMock
        instance.analyze_channel_messages = AsyncMock(
            return_value={
                "channel_summary": "This is a summary",
                "topic_analysis": "These are topics",
                "contributor_insights": "These are insights",
                "key_highlights": "These are highlights",
                "model_used": "anthropic/claude-3-sonnet:20240229",
            }
        )

        yield instance


@pytest.fixture
def app() -> FastAPI:
    """Create a FastAPI test app with our router."""
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(analysis_router, prefix="/api/v1/slack")
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
def mock_workspace_id(mock_uuid):
    """Create a mock workspace ID."""
    return mock_uuid


@pytest.fixture
def mock_channel_id(mock_uuid):
    """Create a mock channel ID."""
    return mock_uuid


@pytest.fixture
def mock_get_channel_by_id():
    """Mock the get_channel_by_id function."""
    with patch("app.api.v1.slack.analysis.get_channel_by_id") as mock_func:
        channel = MagicMock(spec=SlackChannel)
        channel.id = "channel-uuid"
        channel.slack_id = "C12345"
        channel.name = "test-channel"
        channel.workspace_id = "workspace-uuid"

        mock_func.return_value = channel
        yield mock_func


@pytest.fixture
def mock_get_channel_messages():
    """Mock the get_channel_messages function."""
    with patch("app.api.v1.slack.analysis.get_channel_messages") as mock_func:
        messages = [
            MagicMock(spec=SlackMessage),
            MagicMock(spec=SlackMessage),
            MagicMock(spec=SlackMessage),
        ]
        for i, msg in enumerate(messages):
            msg.id = f"msg{i + 1}"
            msg.slack_id = f"S{i + 1}"
            msg.user_id = "U12345" if i % 2 == 0 else "U67890"
            msg.text = f"Test message {i + 1}"
            msg.is_thread_parent = i == 0  # First message is a thread parent
            msg.is_thread_reply = i == 1  # Second message is a thread reply
            msg.reaction_count = i  # Increasing reaction counts
            msg.message_datetime = datetime.now() - timedelta(hours=i)

        mock_func.return_value = messages
        yield mock_func


@pytest.fixture
def mock_get_channel_users():
    """Mock the get_channel_users function."""
    with patch("app.api.v1.slack.analysis.get_channel_users") as mock_func:
        users = [
            MagicMock(spec=SlackUser),
            MagicMock(spec=SlackUser),
        ]

        users[0].id = "user-uuid-1"
        users[0].slack_id = "U12345"
        users[0].name = "user1"
        users[0].display_name = "User One"

        users[1].id = "user-uuid-2"
        users[1].slack_id = "U67890"
        users[1].name = "user2"
        users[1].display_name = "User Two"

        mock_func.return_value = users
        yield mock_func


def test_analyze_channel_success(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
    mock_get_channel_by_id,
    mock_get_channel_messages,
    mock_get_channel_users,
    mock_openrouter_service,
):
    """Test successful channel analysis with deprecated endpoint."""
    # Make the request
    response = client.post(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze",
        params={
            "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
            "end_date": datetime.now().isoformat(),
            "include_threads": "true",
            "include_reactions": "true",
        },
    )

    # Assert the response - now 410 Gone because API is deprecated
    assert response.status_code == 410
    result = response.json()

    # Check structure for deprecation message
    assert "message" in result
    assert "suggested_alternative" in result
    
    # Check message contains deprecation notice
    assert "deprecated" in result["message"].lower()
    assert "integrations" in result["suggested_alternative"].lower()


def test_analyze_channel_with_model_override(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
    mock_get_channel_by_id,
    mock_get_channel_messages,
    mock_get_channel_users,
    mock_openrouter_service,
):
    """Test channel analysis with model override on deprecated endpoint."""
    # Make the request with model override
    custom_model = "anthropic/claude-3-opus:20240229"
    response = client.post(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze",
        params={
            "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
            "end_date": datetime.now().isoformat(),
            "model": custom_model,
        },
    )

    # Assert the response - now 410 Gone because API is deprecated
    assert response.status_code == 410
    result = response.json()
    
    # Check deprecation message
    assert "deprecated" in result["message"].lower()
    assert "integrations" in result["suggested_alternative"].lower()


def test_analyze_channel_no_dates(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
    mock_get_channel_by_id,
    mock_get_channel_messages,
    mock_get_channel_users,
    mock_openrouter_service,
):
    """Test channel analysis with default date range on deprecated endpoint."""
    # Make the request without date parameters
    response = client.post(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze"
    )

    # Assert the response - now 410 Gone because API is deprecated
    assert response.status_code == 410
    result = response.json()
    
    # Check deprecation message
    assert "deprecated" in result["message"].lower()
    assert "integrations" in result["suggested_alternative"].lower()


def test_analyze_channel_not_found(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
):
    """Test channel analysis when channel is not found."""
    # Mock get_channel_by_id to return None
    with patch("app.api.v1.slack.analysis.get_channel_by_id", return_value=None):
        # Make the request
        response = client.post(
            f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze"
        )

    # Assert the response - the API has been deprecated and returns 410 Gone
    assert response.status_code == 410
    assert "deprecated" in response.json()["message"].lower()
    assert "integrations" in response.json()["suggested_alternative"].lower()


def test_analyze_channel_error_handling(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
    mock_get_channel_by_id,
    mock_get_channel_messages,
    mock_get_channel_users,
):
    """Test error handling in the deprecated analysis endpoint."""
    # Mock OpenRouterService to raise an exception
    with patch("app.api.v1.slack.analysis.OpenRouterService") as mock_class:
        instance = MagicMock()
        mock_class.return_value = instance
        instance.analyze_channel_messages = AsyncMock(
            side_effect=ValueError("Test error from OpenRouter")
        )

        # Make the request
        response = client.post(
            f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze"
        )

    # Assert the response - now 410 Gone because API is deprecated
    assert response.status_code == 410
    result = response.json()
    
    # Check deprecation message
    assert "deprecated" in result["message"].lower()
    assert "integrations" in result["suggested_alternative"].lower()