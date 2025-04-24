"""Factory for creating resource analysis services."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import AnalysisResourceType
from app.services.analysis.base import ResourceAnalysisService
from app.services.analysis.slack_channel import SlackChannelAnalysisService
from app.services.llm.openrouter import OpenRouterService

logger = logging.getLogger(__name__)


class ResourceAnalysisServiceFactory:
    """
    Factory for creating resource analysis services based on resource type.
    """

    @staticmethod
    def create_service(
        resource_type: str,
        db: AsyncSession,
        llm_client: Optional[OpenRouterService] = None,
    ) -> ResourceAnalysisService:
        """
        Create a resource analysis service for the given resource type.

        Args:
            resource_type: Type of resource to analyze
            db: Database session
            llm_client: Optional LLM client to use (will create one if None)

        Returns:
            Appropriate resource analysis service for the resource type

        Raises:
            ValueError: If resource type is not supported
        """
        if resource_type == AnalysisResourceType.SLACK_CHANNEL:
            return SlackChannelAnalysisService(db, llm_client)

        # TODO: Add support for other resource types
        # elif resource_type == AnalysisResourceType.GITHUB_REPO:
        #     return GitHubRepoAnalysisService(db, llm_client)
        # elif resource_type == AnalysisResourceType.NOTION_PAGE:
        #     return NotionPageAnalysisService(db, llm_client)

        # If resource type is not supported
        logger.error(f"Unsupported resource type: {resource_type}")
        raise ValueError(f"Unsupported resource type: {resource_type}")
