"""
Service for storing and retrieving LLM analysis results in the database.

DEPRECATED: This module is being phased out in favor of the ResourceAnalysis system.
All functionality has been moved to the integration-based ResourceAnalysis system.
"""

import logging
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AnalysisStoreService:
    """
    Service for storing and retrieving LLM analysis results.
    
    DEPRECATED: This service has been deprecated in favor of the ResourceAnalysis system.
    """

    @staticmethod
    async def store_channel_analysis(*args, **kwargs):
        """
        DEPRECATED: This method has been removed.
        Please use ResourceAnalysisService instead.
        """
        logger.warning(
            "AnalysisStoreService.store_channel_analysis is deprecated. "
            "Use ResourceAnalysisService instead."
        )
        return None

    @staticmethod
    async def get_channel_analyses_for_channel(
        db: AsyncSession, channel_id: str, limit: int = 10, offset: int = 0
    ) -> List:
        """
        DEPRECATED: This method has been removed.
        Please use ResourceAnalysisService instead.
        """
        logger.warning(
            "AnalysisStoreService.get_channel_analyses_for_channel is deprecated. "
            "Use ResourceAnalysisService instead."
        )
        return []

    @staticmethod
    async def get_latest_channel_analysis(
        db: AsyncSession, channel_id: str
    ) -> Optional[None]:
        """
        DEPRECATED: This method has been removed.
        Please use ResourceAnalysisService instead.
        """
        logger.warning(
            "AnalysisStoreService.get_latest_channel_analysis is deprecated. "
            "Use ResourceAnalysisService instead."
        )
        return None