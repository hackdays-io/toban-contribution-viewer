"""Base service for resource analysis."""

import abc
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import ReportStatus, ResourceAnalysis

logger = logging.getLogger(__name__)


class ResourceAnalysisService(abc.ABC):
    """
    Base abstract class for resource analysis services.

    This class defines the interface and common functionality for all
    resource-specific analysis services.
    """

    def __init__(self, db: AsyncSession):
        """
        Initialize with a database session.

        Args:
            db: Database session
        """
        self.db = db

    @abc.abstractmethod
    async def fetch_data(
        self, resource_id: UUID, start_date: datetime, end_date: datetime, **kwargs
    ) -> Dict[str, Any]:
        """
        Fetch data for a specific resource within a date range.

        Args:
            resource_id: ID of the resource to analyze
            start_date: Start date for the analysis period
            end_date: End date for the analysis period
            kwargs: Additional parameters specific to the resource type

        Returns:
            Dictionary containing the resource data
        """

    @abc.abstractmethod
    async def analyze_data(
        self, data: Dict[str, Any], analysis_type: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Analyze resource data using LLM.

        Args:
            data: Resource data to analyze
            analysis_type: Type of analysis to perform (contribution, topics, etc.)
            kwargs: Additional parameters for the analysis

        Returns:
            Analysis results from the LLM
        """

    @abc.abstractmethod
    async def prepare_data_for_analysis(
        self, data: Dict[str, Any], analysis_type: str
    ) -> Dict[str, Any]:
        """
        Process raw resource data into a format suitable for LLM analysis.

        Args:
            data: Raw resource data
            analysis_type: Type of analysis to perform

        Returns:
            Processed data ready for LLM analysis
        """

    async def update_analysis_status(
        self,
        analysis_id: UUID,
        status: ReportStatus,
        progress: Optional[float] = None,
        message: Optional[str] = None,
    ) -> ResourceAnalysis:
        """
        Update the status of a resource analysis.

        Args:
            analysis_id: ID of the analysis to update
            status: New status for the analysis
            progress: Optional progress percentage (0-100)
            message: Optional status message or error message

        Returns:
            Updated ResourceAnalysis object
        """
        from sqlalchemy import select, update

        logger.info(f"Updating analysis {analysis_id} status to {status}")

        # Update the analysis status
        await self.db.execute(
            update(ResourceAnalysis)
            .where(ResourceAnalysis.id == analysis_id)
            .values(
                status=status,
                # Add error message to results if status is failed
                results=(
                    {"error": message}
                    if status == ReportStatus.FAILED and message
                    else None
                ),
            )
        )

        # Return the updated analysis
        result = await self.db.execute(
            select(ResourceAnalysis).where(ResourceAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        return analysis

    async def store_analysis_results(
        self,
        analysis_id: UUID,
        results: Dict[str, Any],
        contributor_insights: Optional[str] = None,
        topic_analysis: Optional[str] = None,
        resource_summary: Optional[str] = None,
        key_highlights: Optional[str] = None,
        model_used: Optional[str] = None,
    ) -> ResourceAnalysis:
        """
        Store analysis results in the database.

        Args:
            analysis_id: ID of the analysis to update
            results: Full LLM analysis results as a dictionary
            contributor_insights: Optional extracted contributor insights text
            topic_analysis: Optional extracted topic analysis text
            resource_summary: Optional extracted resource summary text
            key_highlights: Optional extracted key highlights text
            model_used: Optional name of the LLM model used

        Returns:
            Updated ResourceAnalysis object
        """
        from sqlalchemy import select, update

        logger.info(f"Storing analysis results for {analysis_id}")

        update_values = {
            "results": results,
            "status": ReportStatus.COMPLETED,
            "analysis_generated_at": datetime.utcnow(),
        }

        # Add optional fields if provided
        if contributor_insights is not None:
            update_values["contributor_insights"] = contributor_insights
        if topic_analysis is not None:
            update_values["topic_analysis"] = topic_analysis
        if resource_summary is not None:
            update_values["resource_summary"] = resource_summary
        if key_highlights is not None:
            update_values["key_highlights"] = key_highlights
        if model_used is not None:
            update_values["model_used"] = model_used

        # Update the analysis
        await self.db.execute(
            update(ResourceAnalysis)
            .where(ResourceAnalysis.id == analysis_id)
            .values(**update_values)
        )

        # Return the updated analysis
        result = await self.db.execute(
            select(ResourceAnalysis).where(ResourceAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        return analysis

    async def handle_errors(
        self,
        error: Exception,
        analysis_id: UUID,
        max_retries: int = 3,
        current_retry: int = 0,
    ) -> ResourceAnalysis:
        """
        Handle errors during the analysis process.

        Args:
            error: The exception that occurred
            analysis_id: ID of the analysis that failed
            max_retries: Maximum number of retry attempts
            current_retry: Current retry attempt number

        Returns:
            Updated ResourceAnalysis object
        """
        logger.error(f"Error in analysis {analysis_id}: {str(error)}", exc_info=True)

        # If we haven't reached max retries, we might want to retry
        if current_retry < max_retries:
            # For certain error types, we might want to retry
            if self._is_retryable_error(error):
                logger.info(
                    f"Retrying analysis {analysis_id} (attempt {current_retry + 1}/{max_retries})"
                )
                # Mark as pending for retry
                return await self.update_analysis_status(
                    analysis_id=analysis_id,
                    status=ReportStatus.PENDING,
                    message=f"Retrying after error: {str(error)}",
                )

        # If we can't retry, mark as failed
        logger.warning(f"Analysis {analysis_id} failed: {str(error)}")
        return await self.update_analysis_status(
            analysis_id=analysis_id, status=ReportStatus.FAILED, message=str(error)
        )

    def _is_retryable_error(self, error: Exception) -> bool:
        """
        Determine if an error is retryable.

        Args:
            error: The exception to check

        Returns:
            True if the error is retryable, False otherwise
        """
        # Network errors, rate limits, etc. are usually retryable
        retryable_error_types = (
            ConnectionError,
            TimeoutError,
        )

        # Check if the error is a retryable type
        if isinstance(error, retryable_error_types):
            return True

        # Custom logic for specific error messages
        error_message = str(error).lower()
        retryable_phrases = ["rate limit", "timeout", "connection", "retry"]

        return any(phrase in error_message for phrase in retryable_phrases)

    async def run_analysis(
        self,
        analysis_id: UUID,
        resource_id: UUID,
        integration_id: UUID,
        analysis_type: str,
        period_start: datetime,
        period_end: datetime,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ResourceAnalysis:
        """
        Run a complete analysis on a resource.

        This method orchestrates the entire analysis process:
        1. Update status to in progress
        2. Fetch data from the resource
        3. Process the data for analysis
        4. Send to LLM for analysis
        5. Store the results
        6. Update status to completed

        Args:
            analysis_id: ID of the analysis to run
            resource_id: ID of the resource to analyze
            integration_id: ID of the integration the resource belongs to
            analysis_type: Type of analysis to perform
            period_start: Start date for the analysis period
            period_end: End date for the analysis period
            parameters: Optional parameters for the analysis

        Returns:
            Completed ResourceAnalysis object
        """
        try:
            # Update status to in progress
            await self.update_analysis_status(
                analysis_id=analysis_id, status=ReportStatus.IN_PROGRESS
            )

            # Fetch data from the resource
            data = await self.fetch_data(
                resource_id=resource_id,
                start_date=period_start,
                end_date=period_end,
                integration_id=integration_id,
                parameters=parameters or {},
            )

            # Process the data for analysis
            processed_data = await self.prepare_data_for_analysis(
                data=data, analysis_type=analysis_type
            )

            # Send to LLM for analysis
            results = await self.analyze_data(
                data=processed_data,
                analysis_type=analysis_type,
                parameters=parameters or {},
            )

            # Extract specific sections from the results
            contributor_insights = results.get("contributor_insights")
            topic_analysis = results.get("topic_analysis")
            resource_summary = results.get("resource_summary")
            key_highlights = results.get("key_highlights")
            model_used = results.get("model_used")

            # Store the results
            analysis = await self.store_analysis_results(
                analysis_id=analysis_id,
                results=results,
                contributor_insights=contributor_insights,
                topic_analysis=topic_analysis,
                resource_summary=resource_summary,
                key_highlights=key_highlights,
                model_used=model_used,
            )

            logger.info(f"Analysis {analysis_id} completed successfully")
            return analysis

        except Exception as e:
            return await self.handle_errors(error=e, analysis_id=analysis_id)
