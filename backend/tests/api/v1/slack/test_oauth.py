"""
Tests for Slack OAuth integration.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.api.router import router as api_router
from app.config import settings


@pytest.fixture
def app():
    app = FastAPI()
    
    # Use api_router directly - it already has /api prefix
    app.include_router(api_router)
    
    # Debug: print available routes
    for route in app.routes:
        print(f"Route: {route.path}, methods: {route.methods}")
    
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def test_get_oauth_url(client, monkeypatch):
    """Test getting Slack OAuth URL."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", "test_client_id")
    
    # Make request
    response = client.get("/api/v1/slack/oauth-url")
    
    # Check response
    assert response.status_code == 200
    assert "url" in response.json()
    assert "test_client_id" in response.json()["url"]
    # The URL is encoded, so check for the encoded parameter instead
    assert "channels%3Ahistory" in response.json()["url"]


def test_get_oauth_url_missing_client_id(client, monkeypatch):
    """Test error when client ID is missing."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", None)
    
    # Make request
    response = client.get("/api/v1/slack/oauth-url")
    
    # Check response
    assert response.status_code == 500
    assert "not properly configured" in response.json()["detail"]


@patch("requests.post")
def test_oauth_callback_success(mock_post, client, monkeypatch):
    """Test successful OAuth callback."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", "test_client_id")
    monkeypatch.setattr(settings, "SLACK_CLIENT_SECRET", MagicMock(get_secret_value=lambda: "test_secret"))
    
    # Mock response from Slack API
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "ok": True,
        "app_id": "A12345",
        "authed_user": {"id": "U12345"},
        "scope": "channels:history,channels:read",
        "token_type": "bot",
        "access_token": "xoxb-test-token",
        "bot_user_id": "B12345",
        "team": {"id": "T12345", "name": "Test Team", "domain": "test"},
        "is_enterprise_install": False
    }
    mock_post.return_value = mock_response
    
    # Mock the async context manager
    async def mock_async_db():
        mock_db = MagicMock()
        mock_db.execute = MagicMock()
        # Ensure the result of execute has a .scalars().first() chain that returns None
        execute_result = MagicMock()
        scalars_result = MagicMock()
        scalars_result.first.return_value = None  # No existing workspace
        execute_result.scalars.return_value = scalars_result
        mock_db.execute.return_value = execute_result
        
        mock_db.commit = MagicMock()
        mock_db.close = MagicMock()
        yield mock_db

    # Replace the get_async_db function
    with patch("app.api.v1.slack.oauth.get_async_db", mock_async_db):
        # Make request
        response = client.get("/api/v1/slack/oauth-callback?code=test_code")
        
        # Check response
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify API call
        mock_post.assert_called_once()
        assert "oauth.v2.access" in mock_post.call_args[0][0]
        assert "test_client_id" in mock_post.call_args[1]["data"]["client_id"]


@patch("requests.post")
def test_oauth_callback_error(mock_post, client, monkeypatch):
    """Test OAuth callback with API error."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", "test_client_id")
    monkeypatch.setattr(settings, "SLACK_CLIENT_SECRET", MagicMock(get_secret_value=lambda: "test_secret"))
    
    # Mock response from Slack API
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "ok": False,
        "error": "invalid_code"
    }
    mock_post.return_value = mock_response
    
    # Mock the async context manager
    async def mock_async_db():
        mock_db = MagicMock()
        yield mock_db
    
    # Make request
    with patch("app.api.v1.slack.oauth.get_async_db", mock_async_db):
        response = client.get("/api/v1/slack/oauth-callback?code=invalid_code")
        
        # Check response
        assert response.status_code == 400
        assert "invalid_code" in response.json()["detail"]


def test_oauth_callback_with_error_param(client):
    """Test OAuth callback with error parameter."""
    # Mock the async context manager
    async def mock_async_db():
        mock_db = MagicMock()
        yield mock_db
    
    # Make request with error
    with patch("app.api.v1.slack.oauth.get_async_db", mock_async_db):
        response = client.get("/api/v1/slack/oauth-callback?code=test_code&error=access_denied")
        
        # Check response
        assert response.status_code == 400
        assert "access_denied" in response.json()["detail"]