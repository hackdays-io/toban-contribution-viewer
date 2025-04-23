"""
Task scheduler for resource analysis.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.models.reports import ReportStatus, ResourceAnalysis
from app.services.analysis.factory import ResourceAnalysisServiceFactory

logger = logging.getLogger(__name__)


class ResourceAnalysisTaskScheduler:
    """
    Task scheduler for resource analysis.

    This class is responsible for scheduling and managing resource analysis tasks.
    It provides methods to:
    - Schedule a new analysis
    - Schedule analyses for a cross-resource report
    - Check task status
    - Cancel running tasks
    """

    _tasks: Dict[str, asyncio.Task] = {}

    @classmethod
    async def schedule_analysis(
        cls, analysis_id: Union[str, UUID], db: Optional[AsyncSession] = None
    ) -> bool:
        """
        Schedule a resource analysis task.

        Args:
            analysis_id: ID of the ResourceAnalysis to run
            db: Optional database session

        Returns:
            True if the task was scheduled, False otherwise
        """
        analysis_id_str = str(analysis_id)
        logger.info(f"Scheduling analysis task for {analysis_id_str}")

        # Don't schedule if already running
        if analysis_id_str in cls._tasks and not cls._tasks[analysis_id_str].done():
            logger.warning(f"Analysis {analysis_id_str} is already running")
            return False

        # Create a new task
        task = asyncio.create_task(
            cls._run_analysis(analysis_id), name=f"analysis_{analysis_id_str}"
        )

        # Store the task
        cls._tasks[analysis_id_str] = task

        # Add a callback to remove the task when done
        task.add_done_callback(lambda t: cls._cleanup_task(analysis_id_str, t))

        return True

    @classmethod
    async def schedule_analyses_for_report(
        cls, report_id: Union[str, UUID], db: Optional[AsyncSession] = None
    ) -> int:
        """
        Schedule analysis tasks for all analyses in a cross-resource report.

        Args:
            report_id: ID of the CrossResourceReport
            db: Optional database session

        Returns:
            Number of tasks scheduled
        """
        # Get a DB session if not provided
        close_db = False
        if db is None:
            db_gen = get_async_db()
            db = await db_gen.__anext__()
            close_db = True

        try:
            # Get all analyses for the report that are PENDING or FAILED
            analyses_result = await db.execute(
                select(ResourceAnalysis).where(
                    ResourceAnalysis.cross_resource_report_id == report_id,
                    ResourceAnalysis.status.in_(
                        [ReportStatus.PENDING, ReportStatus.FAILED]
                    ),
                )
            )
            analyses = analyses_result.scalars().all()

            # Schedule each analysis
            scheduled_count = 0
            for analysis in analyses:
                scheduled = await cls.schedule_analysis(analysis.id, db)
                if scheduled:
                    scheduled_count += 1

            return scheduled_count

        finally:
            # Close the DB session if we created it
            if close_db:
                await db.close()

    @classmethod
    def get_task_status(cls, analysis_id: Union[str, UUID]) -> str:
        """
        Get the status of an analysis task.

        Args:
            analysis_id: ID of the analysis

        Returns:
            Status string: "RUNNING", "COMPLETED", "FAILED", or "NOT_FOUND"
        """
        analysis_id_str = str(analysis_id)

        if analysis_id_str not in cls._tasks:
            return "NOT_FOUND"

        task = cls._tasks[analysis_id_str]

        if task.done():
            try:
                # This will re-raise any exception from the task
                task.result()
                return "COMPLETED"
            except Exception:
                return "FAILED"
        else:
            return "RUNNING"

    @classmethod
    def cancel_task(cls, analysis_id: Union[str, UUID]) -> bool:
        """
        Cancel a running analysis task.

        Args:
            analysis_id: ID of the analysis to cancel

        Returns:
            True if the task was cancelled, False if not found or already done
        """
        analysis_id_str = str(analysis_id)

        if analysis_id_str not in cls._tasks:
            return False

        task = cls._tasks[analysis_id_str]

        if not task.done():
            task.cancel()
            return True

        return False

    @classmethod
    def get_all_running_tasks(cls) -> List[str]:
        """
        Get a list of all running analysis task IDs.

        Returns:
            List of analysis IDs with running tasks
        """
        return [task_id for task_id, task in cls._tasks.items() if not task.done()]

    @classmethod
    def _cleanup_task(cls, analysis_id: str, task: asyncio.Task) -> None:
        """
        Clean up a completed task.

        Args:
            analysis_id: ID of the analysis
            task: The completed task
        """
        # Check for exceptions (don't re-raise, just log)
        try:
            # This will raise any exception from the task
            task.result()
        except asyncio.CancelledError:
            logger.info(f"Analysis task {analysis_id} was cancelled")
        except Exception as e:
            logger.error(f"Analysis task {analysis_id} failed: {str(e)}", exc_info=True)

        # Remove the task from our tracking dict to avoid memory leaks
        if analysis_id in cls._tasks:
            del cls._tasks[analysis_id]

    @classmethod
    async def _run_analysis(cls, analysis_id: Union[str, UUID]) -> None:
        """
        Run a resource analysis task.

        This method is the main entry point for running an analysis task.
        It will:
        1. Get the analysis from the database
        2. Create the appropriate service for the resource type
        3. Run the analysis
        4. Handle any exceptions

        Args:
            analysis_id: ID of the analysis to run
        """
        # Create a new DB session for this task
        db_gen = get_async_db()
        db = await db_gen.__anext__()

        try:
            # Get the analysis
            analysis_result = await db.execute(
                select(ResourceAnalysis).where(ResourceAnalysis.id == analysis_id)
            )
            analysis = analysis_result.scalar_one_or_none()

            if not analysis:
                logger.error(f"Analysis {analysis_id} not found")
                return

            # Create the appropriate service
            try:
                service = ResourceAnalysisServiceFactory.create_service(
                    resource_type=analysis.resource_type, db=db
                )
            except ValueError as e:
                logger.error(f"Failed to create service: {str(e)}")
                await db.commit()
                return

            # Run the analysis
            await service.run_analysis(
                analysis_id=analysis.id,
                resource_id=analysis.resource_id,
                integration_id=analysis.integration_id,
                analysis_type=analysis.analysis_type,
                period_start=analysis.period_start,
                period_end=analysis.period_end,
                parameters=analysis.analysis_parameters,
            )

            # Commit changes
            await db.commit()

        except asyncio.CancelledError:
            # Cancellation is not an error
            logger.info(f"Analysis {analysis_id} was cancelled")
            raise

        except Exception as e:
            # Log and propagate other exceptions
            logger.error(
                f"Error running analysis {analysis_id}: {str(e)}", exc_info=True
            )
            await db.commit()
            raise

        finally:
            # Always close the session
            await db.close()
