"""Tests for SlackChannelAnalysisService."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration
from app.models.reports import AnalysisType
from app.models.slack import SlackChannel, SlackMessage
from app.services.analysis.slack_channel import SlackChannelAnalysisService
from app.services.llm.openrouter import OpenRouterService


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_fetch_data(_mock_openrouter):
    """Test fetching data for Slack channel analysis."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Mock the necessary database objects
    channel = SlackChannel(
        id=uuid.uuid4(),
        name="test-channel",
        slack_id="C12345",
        type="public",
        purpose="Test purpose",
        topic="Test topic",
        member_count=10,
        workspace_id=uuid.uuid4(),
    )

    integration = Integration(
        id=uuid.uuid4(),
        name="Test Workspace",
        service_type="SLACK",
        external_id="T12345",
    )

    # Set up mock for db.execute for channel query
    channel_result = MagicMock()
    channel_result.scalar_one_or_none.return_value = channel

    # Set up mock for db.execute for integration query
    integration_result = MagicMock()
    integration_result.scalar_one_or_none.return_value = integration

    # Set up db.execute to return different results based on the query
    db.execute.side_effect = [channel_result, integration_result]

    # Mock the message service
    message_service = AsyncMock()
    now = datetime.utcnow()
    start_date = now - timedelta(days=30)
    messages = [
        SlackMessage(
            id=uuid.uuid4(),
            slack_id="1234",
            slack_ts="1234.5678",
            text="Test message",
            user_id=uuid.uuid4(),
            channel_id=channel.id,
            message_datetime=now - timedelta(days=15),
            is_thread_parent=False,
            is_thread_reply=False,
            reply_count=0,
            reaction_count=0,
            message_type="message",
        )
    ]
    message_service.get_channel_messages.return_value = messages

    # Create the service
    service = SlackChannelAnalysisService(db)
    service.message_service = message_service

    # Call the method
    data = await service.fetch_data(
        resource_id=channel.id,
        start_date=start_date,
        end_date=now,
        integration_id=integration.id,
    )

    # Verify results
    assert data["channel"]["id"] == str(channel.id)
    assert data["channel"]["name"] == channel.name
    assert data["channel"]["purpose"] == channel.purpose
    assert data["channel"]["workspace_name"] == integration.name
    assert len(data["messages"]) == 1
    assert data["messages"][0]["text"] == "Test message"
    assert data["period"]["start"] == start_date.isoformat()
    assert data["period"]["end"] == now.isoformat()
    assert data["metadata"]["message_count"] == 1


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_prepare_data_for_analysis_contribution(_mock_openrouter):
    """Test preparing data for contribution analysis."""
    # Create test data
    test_data = {
        "channel_name": "test-channel",
        "channel_purpose": "Test purpose",
        "channel_topic": "Test topic",
        "channel_type": "public",
        "workspace_name": "Test Workspace",
        "period_start": "2023-01-01T00:00:00",
        "period_end": "2023-01-31T23:59:59",
        "total_messages": 100,
        "total_users": 5,
        "total_threads": 10,
        "messages": [
            {
                "id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
                "text": "Test message",
                "thread_ts": None,
                "is_thread_parent": False,
                "is_thread_reply": False,
                "reply_count": 0,
                "reaction_count": 1,
                "timestamp": "2023-01-15T12:00:00",
                "has_attachments": False,
            }
        ],
        "users": [
            {
                "id": str(uuid.uuid4()),
                "name": "testuser",
                "display_name": "Test User",
                "real_name": "Test User Real",
                "is_bot": False,
                "title": "Developer",
            }
        ],
    }

    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Create the service
    service = SlackChannelAnalysisService(db)

    # Call the method
    prepared_data = await service.prepare_data_for_analysis(
        data=test_data, analysis_type=AnalysisType.CONTRIBUTION
    )

    # Verify results
    assert "channel_name" in prepared_data
    assert prepared_data["channel_name"] == "test-channel"
    assert "user_contributions" in prepared_data


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_prepare_data_for_analysis_topics(_mock_openrouter):
    """Test preparing data for topic analysis."""
    # Create test data with messages
    user_id = str(uuid.uuid4())
    test_data = {
        "channel_name": "test-channel",
        "channel_purpose": "Test purpose",
        "channel_topic": "Test topic",
        "channel_type": "public",
        "workspace_name": "Test Workspace",
        "period_start": "2023-01-01T00:00:00",
        "period_end": "2023-01-31T23:59:59",
        "total_messages": 100,
        "total_users": 5,
        "total_threads": 10,
        "messages": [
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "text": "Test message about topic A",
                "timestamp": "2023-01-15T12:00:00",
                "is_thread_parent": False,
                "is_thread_reply": False,
                "reply_count": 0,
                "reaction_count": 0,
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "text": "Another message about topic B",
                "timestamp": "2023-01-16T12:00:00",
                "is_thread_parent": False,
                "is_thread_reply": False,
                "reply_count": 0,
                "reaction_count": 0,
            },
        ],
        "users": [
            {
                "id": user_id,
                "name": "testuser",
                "display_name": "Test User",
                "real_name": "Test User Real",
                "is_bot": False,
                "title": "Developer",
            }
        ],
    }

    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Create the service
    service = SlackChannelAnalysisService(db)

    # Call the method
    prepared_data = await service.prepare_data_for_analysis(
        data=test_data, analysis_type=AnalysisType.TOPICS
    )

    # Verify results
    assert "channel_name" in prepared_data
    assert prepared_data["channel_name"] == "test-channel"
    assert "messages_by_date" in prepared_data
    # Should have messages grouped by date
    assert len(prepared_data["messages_by_date"]) >= 1


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_analyze_data(_mock_openrouter):
    """Test analyzing data with LLM."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Mock the LLM service
    llm_client = AsyncMock(spec=OpenRouterService)

    # Mock the LLM response
    llm_response = {
        "channel_summary": "Test summary",
        "contributor_insights": "Test insights",
        "topic_analysis": "Test topics",
        "key_highlights": "Test highlights",
        "model_used": "test-model",
    }
    llm_client.analyze_channel_messages.return_value = llm_response

    # Create the service with the mock LLM client
    service = SlackChannelAnalysisService(db, llm_client)

    # Mock the get_prompt_template method
    test_prompt = "Test prompt template {context['channel_name']}"
    with patch.object(service, "get_prompt_template", return_value=test_prompt):
        # Create a mock context for LLM
        with patch.object(
            service,
            "create_context_for_llm",
            return_value={"channel_name": "test-channel"},
        ):
            # Call the method
            test_data = {"channel_name": "test-channel"}
            results = await service.analyze_data(
                data=test_data, analysis_type=AnalysisType.CONTRIBUTION
            )

            # Verify results
            assert "contributor_insights" in results
            assert results["contributor_insights"] == "Test insights"
            assert "topic_analysis" in results
            assert "resource_summary" in results
            assert "key_highlights" in results
            assert "model_used" in results


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_parse_llm_response_json(_mock_openrouter):
    """Test parsing LLM response with valid JSON."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Create the service
    service = SlackChannelAnalysisService(db)

    # Create a test response from OpenRouterService
    response = {
        "channel_summary": "Test summary",
        "contributor_insights": "Test insights",
        "key_highlights": "Test highlights",
        "model_used": "test-model",
    }

    # Call the method
    parsed = service.parse_llm_response(response, AnalysisType.CONTRIBUTION)

    # Verify results
    assert "contributor_insights" in parsed
    assert parsed["contributor_insights"] == "Test insights"
    assert "key_highlights" in parsed
    assert "resource_summary" in parsed
    assert "full_response" in parsed


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
@pytest.mark.asyncio
@patch.object(OpenRouterService, "__init__", return_value=None)
async def test_parse_llm_response_text(_mock_openrouter):
    """Test parsing LLM response with section headers but no JSON."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Create the service
    service = SlackChannelAnalysisService(db)

    # Create a test response with just a channel summary containing sections
    response = {
        "channel_summary": """
        CONTRIBUTOR_INSIGHTS:
        User A is the most active contributor.
        
        KEY_HIGHLIGHTS:
        Several important discussions occurred.
        
        RESOURCE_SUMMARY:
        This channel is used for team coordination.
        """,
        "model_used": "test-model",
    }

    # Call the method
    parsed = service.parse_llm_response(response, AnalysisType.CONTRIBUTION)

    # Verify results
    assert "contributor_insights" in parsed
    assert "User A is the most active contributor." in parsed["contributor_insights"]
    assert "key_highlights" in parsed
    assert "resource_summary" in parsed
    assert "full_response" in parsed
