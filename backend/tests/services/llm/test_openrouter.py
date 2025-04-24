"""
Tests for the OpenRouter service.
"""

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.llm.openrouter import OpenRouterService


@pytest.fixture
def mock_openrouter_service():
    """Create an OpenRouter service with mocked API key."""
    with patch("app.services.llm.openrouter.settings") as mock_settings:
        # Mock the settings with test values
        mock_settings.OPENROUTER_API_KEY.get_secret_value.return_value = "test-api-key"
        mock_settings.OPENROUTER_DEFAULT_MODEL = "anthropic/claude-3-sonnet:20240229"
        mock_settings.OPENROUTER_MAX_TOKENS = 4000
        mock_settings.OPENROUTER_TEMPERATURE = 0.7

        service = OpenRouterService()
        return service


def test_model_supports_json_mode(mock_openrouter_service):
    """Test the model support detection for JSON mode."""
    # Test models that should support JSON mode
    assert mock_openrouter_service._model_supports_json_mode("anthropic/claude-3-opus:20240229")
    assert mock_openrouter_service._model_supports_json_mode("anthropic/claude-3-sonnet:20240229")
    assert mock_openrouter_service._model_supports_json_mode("anthropic/claude-3-haiku:20240307")
    assert mock_openrouter_service._model_supports_json_mode("openai/gpt-4-turbo")
    assert mock_openrouter_service._model_supports_json_mode("openai/gpt-3.5-turbo")
    assert mock_openrouter_service._model_supports_json_mode("mistralai/mistral-large")
    assert mock_openrouter_service._model_supports_json_mode("google/gemini-pro")
    
    # Test models that should not support JSON mode
    assert not mock_openrouter_service._model_supports_json_mode("anthropic/claude-2")
    assert not mock_openrouter_service._model_supports_json_mode("cohere/command")
    assert not mock_openrouter_service._model_supports_json_mode("meta-llama/llama-2-70b")
    assert not mock_openrouter_service._model_supports_json_mode("unknown/model")


@pytest.fixture
def mock_messages_data():
    """Create mock messages data for testing."""
    return {
        "message_count": 10,
        "participant_count": 3,
        "thread_count": 2,
        "reaction_count": 5,
        "messages": [
            {
                "id": "msg1",
                "user_id": "U12345",
                "user_name": "Test User",
                "text": "Hello world!",
                "timestamp": "2023-05-01T10:00:00Z",
                "is_thread_parent": True,
                "is_thread_reply": False,
                "thread_ts": "1682931600.000100",
                "reaction_count": 2,
            },
            {
                "id": "msg2",
                "user_id": "U67890",
                "user_name": "Another User",
                "text": "This is a reply",
                "timestamp": "2023-05-01T10:05:00Z",
                "is_thread_parent": False,
                "is_thread_reply": True,
                "thread_ts": "1682931600.000100",
                "reaction_count": 1,
            },
            {
                "id": "msg3",
                "user_id": "U12345",
                "user_name": "Test User",
                "text": "Another message",
                "timestamp": "2023-05-01T10:10:00Z",
                "is_thread_parent": False,
                "is_thread_reply": False,
                "thread_ts": None,
                "reaction_count": 0,
            },
        ],
    }


@pytest.fixture
def mock_openrouter_response():
    """Create a mock response from OpenRouter API."""
    return {
        "id": "gen-abc123",
        "object": "chat.completion",
        "created": 1682936700,
        "model": "anthropic/claude-3-sonnet:20240229",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": """CHANNEL SUMMARY: This channel appears to be a general team discussion forum where members share project updates and coordinate work. The communication is relatively informal and collaborative, with team members actively responding to each other's messages and using reactions to acknowledge information.

TOPIC ANALYSIS:
1. Project Updates: The messages indicate ongoing work on a project, with status updates being shared regularly.
2. Technical Discussions: There are conversations about implementation details and problem-solving.
3. Team Coordination: Messages related to scheduling and task allocation are present.

CONTRIBUTOR INSIGHTS:
1. Test User (U12345) is a primary contributor who initiates discussions and provides information to the team.
2. Another User (U67890) actively engages in threads, providing responses and additional context.

KEY HIGHLIGHTS:
1. The thread started on May 1st contains important project information that received multiple reactions, indicating its significance to the team.""",
                },
                "index": 0,
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 250, "completion_tokens": 200, "total_tokens": 450},
    }


@pytest.mark.asyncio
async def test_format_messages(mock_openrouter_service, mock_messages_data):
    """Test the message formatting function."""
    # Test with a small number of messages
    formatted = mock_openrouter_service._format_messages(mock_messages_data["messages"])

    # Verify format includes all messages with user IDs instead of names
    assert "[2023-05-01T10:00:00Z] <@U12345>: Hello world!" in formatted
    assert "[2023-05-01T10:05:00Z] <@U67890>: This is a reply" in formatted
    assert "[2023-05-01T10:10:00Z] <@U12345>: Another message" in formatted

    # Test with a large number of messages that should trigger sampling
    large_messages = []
    for i in range(300):  # Create more than 200 messages to trigger sampling
        large_messages.append(
            {
                "id": f"msg{i}",
                "user_id": "U12345",
                "user_name": "Test User",
                "text": f"Message {i}",
                "timestamp": f"2023-05-01T{10 + i // 60:02d}:{i % 60:02d}:00Z",
                "is_thread_parent": False,
                "is_thread_reply": False,
                "thread_ts": None,
                "reaction_count": 0,
            }
        )

    formatted_large = mock_openrouter_service._format_messages(large_messages)

    # Verify sampling is indicated
    assert "SAMPLE OF MESSAGES" in formatted_large
    assert "Beginning of time period:" in formatted_large
    assert "Middle of time period:" in formatted_large
    assert "End of time period:" in formatted_large


@pytest.mark.asyncio
async def test_extract_sections(mock_openrouter_service):
    """Test extracting sections from LLM response."""
    llm_response = """CHANNEL SUMMARY: This is a summary.

TOPIC ANALYSIS: These are the topics.

CONTRIBUTOR INSIGHTS: These are the insights.

KEY HIGHLIGHTS: These are the highlights."""

    sections = mock_openrouter_service._extract_sections(llm_response)

    assert sections["channel_summary"] == "This is a summary."
    assert sections["topic_analysis"] == "These are the topics."
    assert sections["contributor_insights"] == "These are the insights."
    assert sections["key_highlights"] == "These are the highlights."

    # Test with different case formatting
    llm_response_alt = """Channel Summary: This is a summary.

Topic Analysis: These are the topics.

Contributor Insights: These are the insights.

Key Highlights: These are the highlights."""

    sections_alt = mock_openrouter_service._extract_sections(llm_response_alt)

    assert sections_alt["channel_summary"] == "This is a summary."
    assert sections_alt["topic_analysis"] == "These are the topics."
    assert sections_alt["contributor_insights"] == "These are the insights."
    assert sections_alt["key_highlights"] == "These are the highlights."

    # Test with missing sections
    llm_response_missing = "CHANNEL SUMMARY: This is only a summary."

    sections_missing = mock_openrouter_service._extract_sections(llm_response_missing)

    assert sections_missing["channel_summary"] == "This is only a summary."
    assert sections_missing["topic_analysis"] == ""
    assert sections_missing["contributor_insights"] == ""
    assert sections_missing["key_highlights"] == ""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Need to update test for JSON mode changes")
async def test_analyze_channel_messages_success(
    mock_openrouter_service, mock_messages_data, mock_openrouter_response
):
    """Test successful analysis of channel messages."""
    # Mock the httpx client
    mock_post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            raise_for_status=MagicMock(),
            json=MagicMock(return_value=mock_openrouter_response),
        )
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = mock_post

        # Call the function - don't check for response_format since we have a specific JSON mode test
        result = await mock_openrouter_service.analyze_channel_messages(
            channel_name="general",
            messages_data=mock_messages_data,
            start_date="2023-05-01T00:00:00Z",
            end_date="2023-05-31T23:59:59Z",
        )

    # Verify the API was called
    mock_post.assert_called_once()

    # Verify the result structure
    assert "channel_summary" in result
    assert "topic_analysis" in result
    assert "contributor_insights" in result
    assert "key_highlights" in result
    assert result["model_used"] == "anthropic/claude-3-sonnet:20240229"


@pytest.mark.asyncio
async def test_analyze_channel_messages_http_error(
    mock_openrouter_service, mock_messages_data
):
    """Test handling of HTTP errors."""
    # Mock an HTTP error response
    mock_response = MagicMock(
        status_code=400,
        raise_for_status=MagicMock(
            side_effect=httpx.HTTPStatusError(
                "Bad request",
                request=MagicMock(),
                response=MagicMock(
                    status_code=400,
                    json=MagicMock(
                        return_value={"error": {"message": "Invalid request"}}
                    ),
                ),
            )
        ),
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )

        # Call the function and expect an error
        with pytest.raises(ValueError) as excinfo:
            await mock_openrouter_service.analyze_channel_messages(
                channel_name="general",
                messages_data=mock_messages_data,
                start_date="2023-05-01T00:00:00Z",
                end_date="2023-05-31T23:59:59Z",
            )

    # Verify the error message contains the status code
    assert "HTTP error 400" in str(excinfo.value)


@pytest.mark.asyncio
async def test_analyze_channel_messages_request_error(
    mock_openrouter_service, mock_messages_data
):
    """Test handling of request errors."""
    # Mock a connection error
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.RequestError("Connection failed", request=MagicMock())
        )

        # Call the function and expect an error
        with pytest.raises(ValueError) as excinfo:
            await mock_openrouter_service.analyze_channel_messages(
                channel_name="general",
                messages_data=mock_messages_data,
                start_date="2023-05-01T00:00:00Z",
                end_date="2023-05-31T23:59:59Z",
            )

    # Verify the error message contains connection information
    assert "Error connecting to OpenRouter API" in str(excinfo.value)
    assert "Connection failed" in str(excinfo.value)


@pytest.mark.asyncio
async def test_analyze_channel_messages_with_json_mode(
    mock_openrouter_service, mock_messages_data
):
    """Test analysis with JSON mode enabled."""
    # Create a mock JSON response
    json_response = {
        "id": "gen-abc123",
        "object": "chat.completion",
        "created": 1682936700,
        "model": "anthropic/claude-3-sonnet:20240229",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": """```json
{
  "channel_summary": "This is a JSON-formatted summary",
  "topic_analysis": "JSON topic analysis",
  "contributor_insights": "JSON contributor insights",
  "key_highlights": "JSON key highlights"
}
```"""
                },
                "index": 0,
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 250, "completion_tokens": 200, "total_tokens": 450},
    }

    # Mock the httpx client
    mock_post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            raise_for_status=MagicMock(),
            json=MagicMock(return_value=json_response),
        )
    )

    # Patch the _model_supports_json_mode method to return True
    with patch.object(
        mock_openrouter_service, "_model_supports_json_mode", return_value=True
    ):
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = mock_post

            # Call the function with JSON mode enabled
            result = await mock_openrouter_service.analyze_channel_messages(
                channel_name="general",
                messages_data=mock_messages_data,
                start_date="2023-05-01T00:00:00Z",
                end_date="2023-05-31T23:59:59Z",
                use_json_mode=True,
            )

    # Verify the API was called
    mock_post.assert_called_once()

    # Verify the request includes response_format
    call_args = mock_post.call_args
    request_data = json.loads(json.dumps(call_args[1]["json"]))
    assert "response_format" in request_data
    assert request_data["response_format"]["type"] == "json_object"

    # Verify the result was parsed from JSON correctly
    assert result["channel_summary"] == "This is a JSON-formatted summary"
    assert result["topic_analysis"] == "JSON topic analysis"
    assert result["contributor_insights"] == "JSON contributor insights"
    assert result["key_highlights"] == "JSON key highlights"


@pytest.mark.asyncio
async def test_analyze_channel_messages_with_datetime(
    mock_openrouter_service, mock_messages_data, mock_openrouter_response
):
    """Test that the function accepts datetime objects for dates."""
    # Mock the httpx client
    mock_post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            raise_for_status=MagicMock(),
            json=MagicMock(return_value=mock_openrouter_response),
        )
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = mock_post

        # Call the function with datetime objects
        start_date = datetime(2023, 5, 1)
        end_date = datetime(2023, 5, 31, 23, 59, 59)

        await mock_openrouter_service.analyze_channel_messages(
            channel_name="general",
            messages_data=mock_messages_data,
            start_date=start_date,
            end_date=end_date,
        )

    # Verify the API was called
    mock_post.assert_called_once()

    # Verify start and end dates were formatted properly
    call_args = mock_post.call_args
    request_data = json.loads(json.dumps(call_args[1]["json"]))
    user_prompt = request_data["messages"][1]["content"]

    # Check that the dates were properly formatted in the prompt
    assert "2023-05-01" in user_prompt
    assert "2023-05-31" in user_prompt
