"""Tests for ResourceAnalysisServiceFactory."""

from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import ResourceType
from app.services.analysis.factory import ResourceAnalysisServiceFactory
from app.services.analysis.slack_channel import SlackChannelAnalysisService


def test_create_service_slack_channel():
    """Test creating a service for Slack channel."""
    # Create db mock
    db = AsyncMock(spec=AsyncSession)

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
        ResourceAnalysisServiceFactory.create_service(
            resource_type="UNSUPPORTED_TYPE", db=db
        )
