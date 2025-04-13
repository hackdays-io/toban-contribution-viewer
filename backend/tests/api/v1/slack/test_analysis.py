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
            msg.id = f"msg{i+1}"
            msg.slack_id = f"S{i+1}"
            msg.user_id = "U12345" if i % 2 == 0 else "U67890"
            msg.text = f"Test message {i+1}"
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
    """Test successful channel analysis."""
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

    # Assert the response
    assert response.status_code == 200
    result = response.json()

    # Check structure
    assert "analysis_id" in result
    assert "channel_id" in result
    assert "channel_name" in result
    assert "period" in result
    assert "stats" in result
    assert "channel_summary" in result
    assert "topic_analysis" in result
    assert "contributor_insights" in result
    assert "key_highlights" in result
    assert "model_used" in result
    assert "generated_at" in result

    # Check specific fields
    assert result["channel_id"] == mock_channel_id
    assert result["channel_name"] == "test-channel"
    assert result["channel_summary"] == "This is a summary"
    assert result["topic_analysis"] == "These are topics"
    assert result["contributor_insights"] == "These are insights"
    assert result["key_highlights"] == "These are highlights"
    assert result["model_used"] == "anthropic/claude-3-sonnet:20240229"

    # Verify stats
    assert result["stats"]["message_count"] == 3
    assert result["stats"]["participant_count"] == 2
    assert result["stats"]["thread_count"] == 1
    assert (
        result["stats"]["reaction_count"] == 3
    )  # Sum of reaction_count values (0+1+2)

    # Verify the LLM service was called with correct parameters
    mock_openrouter_service.analyze_channel_messages.assert_called_once()
    call_kwargs = mock_openrouter_service.analyze_channel_messages.call_args[1]
    assert call_kwargs["channel_name"] == "test-channel"
    assert "start_date" in call_kwargs
    assert "end_date" in call_kwargs
    assert "messages_data" in call_kwargs
    assert call_kwargs["messages_data"]["message_count"] == 3


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
    """Test channel analysis with model override."""
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

    # Assert the response
    assert response.status_code == 200

    # Verify model parameter was passed
    mock_openrouter_service.analyze_channel_messages.assert_called_once()
    call_kwargs = mock_openrouter_service.analyze_channel_messages.call_args[1]
    assert call_kwargs["model"] == custom_model


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
    """Test channel analysis with default date range."""
    # Make the request without date parameters
    response = client.post(
        f"/api/v1/slack/workspaces/{mock_workspace_id}/channels/{mock_channel_id}/analyze"
    )

    # Assert the response
    assert response.status_code == 200

    # Verify date calculations
    mock_get_channel_messages.assert_called_once()
    call_kwargs = mock_get_channel_messages.call_args[1]
    assert "start_date" in call_kwargs
    assert "end_date" in call_kwargs

    # End date should be close to now (accounting for potential timezone differences)
    now = datetime.now()
    end_date = call_kwargs["end_date"]
    difference = abs(now - end_date)
    assert (
        difference.total_seconds() < 60 * 60 * 10
    )  # Within 10 hours (to accommodate any timezone differences)

    # Start date should be 30 days before end date
    start_date = call_kwargs["start_date"]
    difference = end_date - start_date
    assert abs(difference.days - 30) < 1  # Within 1 day of 30 days


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

    # Assert the response
    assert response.status_code == 404
    assert "Channel not found" in response.json()["detail"]


def test_analyze_channel_error_handling(
    app: FastAPI,
    client: TestClient,
    mock_workspace_id: str,
    mock_channel_id: str,
    mock_get_channel_by_id,
    mock_get_channel_messages,
    mock_get_channel_users,
):
    """Test error handling in the analysis endpoint."""
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

    # Assert the response
    assert response.status_code == 400
    assert "Test error from OpenRouter" in response.json()["detail"]
