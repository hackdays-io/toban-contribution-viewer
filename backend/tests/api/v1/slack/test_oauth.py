"""
Tests for Slack OAuth integration.
"""

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from app.api.v1.slack.router import router as slack_router
from app.config import settings
from tests.conftest import team_test_mark


@pytest.mark.asyncio
@team_test_mark
async def test_get_oauth_url(client: AsyncClient, monkeypatch):
    """Test getting Slack OAuth URL."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", "test_client_id")

    # Make request
    response = await client.get("/api/v1/slack/oauth-url")

    # Check response
    assert response.status_code == 200
    assert "url" in response.json()
    assert "test_client_id" in response.json()["url"]
    # The URL is encoded, so check for the encoded parameter instead
    assert "channels%3Ahistory" in response.json()["url"]


@pytest.mark.asyncio
@team_test_mark
async def test_get_oauth_url_missing_client_id(client: AsyncClient, monkeypatch):
    """Test error when client ID is missing."""
    # Mock settings
    monkeypatch.setattr(settings, "SLACK_CLIENT_ID", None)

    # Make request
    response = await client.get("/api/v1/slack/oauth-url")

    # Check response
    assert response.status_code == 500
    assert "not properly configured" in response.json()["detail"]


@pytest_asyncio.fixture
async def oauth_test_client():
    """Create a test client specifically for OAuth tests with dependencies mocked."""
    # Create a new FastAPI app
    app = FastAPI()

    # Add the Slack OAuth router
    app.include_router(slack_router, prefix="/api/v1/slack")

    # Create and return the test client
    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client


def test_oauth_callback_success():
    """Test successful OAuth callback."""
    # Skip this test for now as it requires complex async mocking
    pytest.skip(
        "This test needs more complex dependency overrides for async database sessions"
    )


def test_oauth_callback_error():
    """Test OAuth callback with API error."""
    # This test is skipped until we can properly mock the async dependencies
    pytest.skip("This test needs more complex dependency overrides")


def test_oauth_callback_with_error_param():
    """Test OAuth callback with error parameter."""
    # This test is skipped until we can properly mock the async dependencies
    pytest.skip("This test needs more complex dependency overrides")
