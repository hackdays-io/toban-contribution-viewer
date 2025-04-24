"""Tests for ResourceAnalysisServiceFactory."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import ResourceType
from app.services.analysis.factory import ResourceAnalysisServiceFactory
from app.services.analysis.slack_channel import SlackChannelAnalysisService
from app.services.llm.openrouter import OpenRouterService


@pytest.mark.skip(reason="Needs to be updated to match OpenRouterService interface")
def test_create_service_slack_channel():
    """Test creating a service for Slack channel."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Mock OpenRouterService constructor
    with patch.object(OpenRouterService, "__init__", return_value=None):
        # Call the factory
        service = ResourceAnalysisServiceFactory.create_service(
            resource_type=ResourceType.SLACK_CHANNEL, db=db
        )

        # Verify result
        assert isinstance(service, SlackChannelAnalysisService)


def test_create_service_unsupported_type():
    """Test creating a service for an unsupported resource type."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

    # Call the factory with an invalid type
    with pytest.raises(ValueError):
        # Mock OpenRouterService constructor to avoid real initialization
        with patch.object(OpenRouterService, "__init__", return_value=None):
            ResourceAnalysisServiceFactory.create_service(
                resource_type="UNSUPPORTED_TYPE", db=db
            )
