"""
Tests for Slack API client.
"""
from unittest.mock import AsyncMock, patch

import pytest
from aiohttp.client_reqrep import ClientResponse

from app.services.slack.api import SlackApiClient, SlackApiError, SlackApiRateLimitError


@pytest.fixture
def mock_response():
    """Create a mock aiohttp response."""
    mock = AsyncMock(spec=ClientResponse)
    mock.status = 200
    mock.json = AsyncMock(return_value={"ok": True, "data": "test"})
    mock.headers = {}
    return mock


@pytest.mark.asyncio
@patch("aiohttp.ClientSession.request")
async def test_make_request_success(mock_request, mock_response):
    """Test successful API request."""
    # Setup mock
    mock_request.return_value.__aenter__.return_value = mock_response
    
    # Create client and make request
    client = SlackApiClient("xoxb-test-token")
    result = await client._make_request("GET", "test.method")
    
    # Verify request was made with correct parameters
    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    assert kwargs["method"] == "GET"
    assert kwargs["url"] == "https://slack.com/api/test.method"
    assert kwargs["headers"]["Authorization"] == "Bearer xoxb-test-token"
    
    # Verify result
    assert result == {"ok": True, "data": "test"}


@pytest.mark.asyncio
@patch("aiohttp.ClientSession.request")
async def test_make_request_api_error(mock_request, mock_response):
    """Test handling API errors."""
    # Setup mock with error response
    mock_response.json.return_value = {
        "ok": False,
        "error": "invalid_auth",
        "error_description": "Invalid authentication token"
    }
    mock_request.return_value.__aenter__.return_value = mock_response
    
    # Create client and make request
    client = SlackApiClient("xoxb-test-token")
    
    # Expect an exception
    with pytest.raises(SlackApiError) as exc_info:
        await client._make_request("GET", "test.method")
    
    # Verify exception details
    assert "Invalid authentication token" in str(exc_info.value)
    assert exc_info.value.error_code == "invalid_auth"


@pytest.mark.asyncio
@patch("aiohttp.ClientSession.request")
async def test_make_request_rate_limit(mock_request, mock_response):
    """Test handling rate limits."""
    # Setup mock with rate limit response
    mock_response.status = 429
    mock_response.headers = {"Retry-After": "30"}
    mock_request.return_value.__aenter__.return_value = mock_response
    
    # Create client and make request
    client = SlackApiClient("xoxb-test-token")
    
    # Expect a rate limit exception
    with pytest.raises(SlackApiRateLimitError) as exc_info:
        await client._make_request("GET", "test.method")
    
    # Verify exception details
    assert "Rate limited" in str(exc_info.value)
    assert exc_info.value.retry_after == 30


@pytest.mark.asyncio
@patch("app.services.slack.api.SlackApiClient._make_request")
async def test_get_workspace_info(mock_make_request):
    """Test getting workspace info."""
    # Setup mock response
    mock_make_request.return_value = {
        "ok": True,
        "team": {
            "id": "T12345",
            "name": "Test Workspace",
            "domain": "testworkspace"
        }
    }
    
    # Create client and call method
    client = SlackApiClient("xoxb-test-token")
    result = await client.get_workspace_info()
    
    # Verify request and result
    mock_make_request.assert_called_once_with("GET", "team.info")
    assert result["id"] == "T12345"
    assert result["name"] == "Test Workspace"


@pytest.mark.asyncio
@patch("app.services.slack.api.SlackApiClient._make_request")
async def test_get_user_count(mock_make_request):
    """Test getting user count."""
    # Setup mock response
    mock_make_request.return_value = {
        "ok": True,
        "members": [],  # Not used, just included for realism
        "response_metadata": {
            "total_count": 42
        }
    }
    
    # Create client and call method
    client = SlackApiClient("xoxb-test-token")
    result = await client.get_user_count()
    
    # Verify request and result
    mock_make_request.assert_called_once_with("GET", "users.list", params={"limit": 1})
    assert result == 42


@pytest.mark.asyncio
@patch("app.services.slack.api.SlackApiClient._make_request")
async def test_verify_token_valid(mock_make_request):
    """Test token verification with valid token."""
    # Setup mock response
    mock_make_request.return_value = {
        "ok": True,
        "url": "https://testworkspace.slack.com/",
        "team": "Test Workspace",
        "user": "bot"
    }
    
    # Create client and call method
    client = SlackApiClient("xoxb-test-token")
    result = await client.verify_token()
    
    # Verify request and result
    mock_make_request.assert_called_once_with("GET", "auth.test")
    assert result is True


@pytest.mark.asyncio
@patch("app.services.slack.api.SlackApiClient._make_request")
async def test_verify_token_invalid(mock_make_request):
    """Test token verification with invalid token."""
    # Setup mock to raise an auth error
    mock_make_request.side_effect = SlackApiError(
        message="Invalid authentication",
        error_code="invalid_auth"
    )
    
    # Create client and call method
    client = SlackApiClient("xoxb-test-token")
    result = await client.verify_token()
    
    # Verify request and result
    mock_make_request.assert_called_once_with("GET", "auth.test")
    assert result is False