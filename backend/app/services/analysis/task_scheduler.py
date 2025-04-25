"""
Task scheduler for resource analysis.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.models.reports import CrossResourceReport, ReportStatus, ResourceAnalysis
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
    async def _check_and_update_report_status(
        cls, db: AsyncSession, report_id: UUID
    ) -> None:
        """
        Check the status of all analyses in a report and update the report status if needed.

        Args:
            db: Database session
            report_id: ID of the CrossResourceReport to check
        """
        try:
            # Count the analyses for this report by status
            analyses_result = await db.execute(
                select(ResourceAnalysis.status, func.count().label("count"))
                .where(ResourceAnalysis.cross_resource_report_id == report_id)
                .group_by(ResourceAnalysis.status)
            )

            status_counts = {status: count for status, count in analyses_result.all()}

            # Calculate totals
            total_analyses = sum(status_counts.values())
            completed_analyses = status_counts.get(ReportStatus.COMPLETED, 0)
            failed_analyses = status_counts.get(ReportStatus.FAILED, 0)
            pending_analyses = status_counts.get(ReportStatus.PENDING, 0)
            in_progress_analyses = status_counts.get(ReportStatus.IN_PROGRESS, 0)

            logger.info(f"Report {report_id} status check: {status_counts}")

            # If all analyses are complete, update the report status to COMPLETED
            if total_analyses > 0 and completed_analyses == total_analyses:
                logger.info(
                    f"All analyses for report {report_id} are complete. Updating report status to COMPLETED."
                )
                await db.execute(
                    update(CrossResourceReport)
                    .where(CrossResourceReport.id == report_id)
                    .values(status=ReportStatus.COMPLETED)
                )
                await db.commit()

            # If all analyses are failed, update the report status to FAILED
            elif total_analyses > 0 and failed_analyses == total_analyses:
                logger.warning(
                    f"All analyses for report {report_id} have failed. Updating report status to FAILED."
                )
                await db.execute(
                    update(CrossResourceReport)
                    .where(CrossResourceReport.id == report_id)
                    .values(status=ReportStatus.FAILED)
                )
                await db.commit()

            # If there are no pending or in-progress analyses but we have a mix of completed and failed,
            # mark the report as COMPLETED but should show warnings in the UI
            elif (
                total_analyses > 0
                and pending_analyses == 0
                and in_progress_analyses == 0
            ):
                logger.info(
                    f"Report {report_id} has {completed_analyses} completed and {failed_analyses} failed analyses. Marking as COMPLETED with partial success."
                )
                await db.execute(
                    update(CrossResourceReport)
                    .where(CrossResourceReport.id == report_id)
                    .values(status=ReportStatus.COMPLETED)
                )
                await db.commit()

        except Exception as e:
            logger.error(f"Error checking report status: {e}")

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

            # Get the report if this is part of a multi-channel report
            report = None
            if analysis.cross_resource_report_id:
                report_result = await db.execute(
                    select(CrossResourceReport).where(
                        CrossResourceReport.id == analysis.cross_resource_report_id
                    )
                )
                report = report_result.scalar_one_or_none()

                # For issue #238 - log report details to trace data consistency problems
                if report:
                    logger.info(
                        f"Analysis {analysis_id} is part of report {report.id} "
                        f"with period {report.date_range_start} to {report.date_range_end}"
                    )

                    # If it's multi-channel, check how many resources are in the report
                    resource_count_result = await db.execute(
                        select(func.count())
                        .select_from(ResourceAnalysis)
                        .where(ResourceAnalysis.cross_resource_report_id == report.id)
                    )
                    resource_count = resource_count_result.scalar_one() or 0

                    if resource_count > 1:
                        logger.info(
                            f"Report contains {resource_count} resources (multi-channel analysis)"
                        )
                    else:
                        logger.info(
                            "Report contains only one resource (single-channel analysis)"
                        )

            # Run the analysis
            logger.info(
                f"Running analysis {analysis_id} for resource {analysis.resource_id}"
            )

            # For issue #238 - log the period dates
            logger.info(
                f"Analysis period: {analysis.period_start} to {analysis.period_end} "
                f"(types: {type(analysis.period_start).__name__}, {type(analysis.period_end).__name__})"
            )

            # MULTI-CHANNEL DEBUG: For multi-channel reports, sync messages only if needed
            if report and resource_count > 1:
                try:
                    # Import the message service
                    from app.services.slack.messages import SlackMessageService

                    # Create a new message service - without passing db
                    message_service = SlackMessageService()

                    # Get the channel
                    from app.models.slack import SlackChannel

                    # Find the channel
                    channel_result = await db.execute(
                        select(SlackChannel).where(
                            SlackChannel.id == analysis.resource_id
                        )
                    )
                    channel = channel_result.scalar_one_or_none()

                    if channel:
                        # Check when channel was last synced
                        from datetime import datetime

                        current_time = datetime.utcnow()
                        sync_threshold = 24  # Hours before we need to sync again
                        needs_sync = True

                        if channel.last_sync_at:
                            hours_since_sync = (
                                current_time - channel.last_sync_at
                            ).total_seconds() / 3600
                            needs_sync = hours_since_sync > sync_threshold

                            if needs_sync:
                                logger.info(
                                    f"Channel {channel.name} was last synced {hours_since_sync:.1f} hours ago, exceeding threshold of {sync_threshold} hours"
                                )
                            else:
                                logger.info(
                                    f"Channel {channel.name} was synced recently ({hours_since_sync:.1f} hours ago), skipping sync"
                                )
                        else:
                            logger.info(
                                f"Channel {channel.name} has never been synced, performing initial sync"
                            )

                        if needs_sync:
                            logger.info(
                                f"Multi-channel report: Syncing messages for channel {channel.name} ({channel.id})"
                            )

                            # Sync messages for this channel with the date range
                            sync_result = await message_service.sync_channel_messages(
                                channel_id=str(channel.id),
                                start_date=analysis.period_start,
                                end_date=analysis.period_end,
                                include_replies=True,
                            )

                            logger.info(f"Message sync result: {sync_result}")
                        else:
                            logger.info(
                                f"Skipping message sync for channel {channel.name} (synced within {sync_threshold} hours)"
                            )
                    else:
                        logger.warning(
                            f"Could not find channel {analysis.resource_id} for syncing"
                        )

                except Exception as sync_error:
                    logger.error(
                        f"Error syncing messages for multi-channel report: {str(sync_error)}"
                    )
                    # Continue with analysis even if sync fails

            # Run the actual analysis
            analysis_result = await service.run_analysis(
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

            # Check if this is part of a report and if all analyses are complete
            if analysis.cross_resource_report_id:
                await cls._check_and_update_report_status(
                    db, analysis.cross_resource_report_id
                )

        except asyncio.CancelledError:
            # Cancellation is not an error
            logger.info(f"Analysis {analysis_id} was cancelled")
            raise

        except Exception as e:
            # Log and propagate other exceptions
            logger.error(
                f"Error running analysis {analysis_id}: {str(e)}", exc_info=True
            )

            # Update the analysis status to FAILED
            try:
                await db.execute(
                    update(ResourceAnalysis)
                    .where(ResourceAnalysis.id == analysis_id)
                    .values(status=ReportStatus.FAILED, results={"error": str(e)})
                )
                await db.commit()

                # Check if this analysis is part of a report
                analysis_result = await db.execute(
                    select(ResourceAnalysis.cross_resource_report_id).where(
                        ResourceAnalysis.id == analysis_id
                    )
                )
                cross_resource_report_id = analysis_result.scalar_one_or_none()

                if cross_resource_report_id:
                    await cls._check_and_update_report_status(
                        db, cross_resource_report_id
                    )

            except Exception as update_error:
                logger.error(f"Error updating analysis status: {update_error}")

            raise

        finally:
            # Always close the session
            await db.close()
