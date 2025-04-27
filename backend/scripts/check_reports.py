#!/usr/bin/env python3
"""
Script to check report data consistency.
Verifies that all messages within a given date range are included in reports.

Usage:
    python check_reports.py [cross-resource-report-id]

Example:
    python check_reports.py 123e4567-e89b-12d3-a456-426614174000

If a report ID is provided, checks only that specific report.
Otherwise, checks the most recent 5 reports.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.reports.cross_resource_report import CrossResourceReport, ResourceAnalysis
from app.models.slack import SlackChannel, SlackMessage

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Database connection - hardcoded for local development
DATABASE_URL = "postgresql+asyncpg://toban_admin:postgres@localhost:5432/tobancv"

# Create async database engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    pool_pre_ping=True,
)

# Create async session factory
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)


async def get_report_by_id(db: AsyncSession, report_id: UUID) -> Optional[CrossResourceReport]:
    """
    Get a cross-resource report by ID.
    
    Args:
        db: Database session
        report_id: ID of the report to retrieve
        
    Returns:
        The report if found, None otherwise
    """
    result = await db.execute(sa.select(CrossResourceReport).where(CrossResourceReport.id == report_id))
    return result.scalar_one_or_none()


async def get_recent_reports(db: AsyncSession, limit: int = 5) -> List[CrossResourceReport]:
    """
    Get the most recent cross-resource reports.
    
    Args:
        db: Database session
        limit: Maximum number of reports to retrieve
        
    Returns:
        List of reports
    """
    result = await db.execute(
        sa.select(CrossResourceReport).order_by(CrossResourceReport.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


async def get_resource_analyses(db: AsyncSession, report_id: UUID) -> List[ResourceAnalysis]:
    """
    Get the resource analyses for a cross-resource report.
    
    Args:
        db: Database session
        report_id: ID of the report
        
    Returns:
        List of resource analyses
    """
    result = await db.execute(
        sa.select(ResourceAnalysis).where(ResourceAnalysis.cross_resource_report_id == report_id)
    )
    return result.scalars().all()


async def count_channel_messages(
    db: AsyncSession,
    channel_id: UUID,
    start_date: datetime,
    end_date: datetime,
) -> int:
    """
    Count the number of messages in a channel within a date range.
    
    Args:
        db: Database session
        channel_id: ID of the channel
        start_date: Start date for the count
        end_date: End date for the count
        
    Returns:
        Number of messages
    """
    # Make sure start_date and end_date are naive datetimes
    if start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
        
    result = await db.execute(
        sa.select(sa.func.count())
        .select_from(SlackMessage)
        .where(
            SlackMessage.channel_id == channel_id,
            SlackMessage.message_datetime >= start_date,
            SlackMessage.message_datetime <= end_date,
        )
    )
    return result.scalar_one()


async def check_report_consistency(db: AsyncSession, report_id: UUID) -> Dict[str, Dict[str, int]]:
    """
    Check the consistency of a cross-resource report.
    Compares the number of messages processed in the analysis vs. 
    the actual number of messages in the database for each channel.
    
    Args:
        db: Database session
        report_id: ID of the report to check
        
    Returns:
        Dictionary mapping channel ID to message counts
    """
    logger.info(f"Checking report consistency for report {report_id}")
    
    # Get the report
    report = await get_report_by_id(db, report_id)
    if not report:
        logger.error(f"Report {report_id} not found")
        return {}
    
    logger.info(f"Report details: {report.title}")
    logger.info(f"Date range: {report.date_range_start} to {report.date_range_end}")
    
    # Get the resource analyses
    analyses = await get_resource_analyses(db, report_id)
    if not analyses:
        logger.error(f"No resource analyses found for report {report_id}")
        return {}
    
    logger.info(f"Found {len(analyses)} resource analyses")
    
    # Filter for Slack channel analyses
    slack_analyses = [
        analysis for analysis in analyses 
        if analysis.resource_type.name == "SLACK_CHANNEL"
    ]
    if not slack_analyses:
        logger.info(f"No Slack channel analyses found for report {report_id}")
        return {}
    
    logger.info(f"Found {len(slack_analyses)} Slack channel analyses")
    
    # Get the date range for the report
    start_date = report.date_range_start
    end_date = report.date_range_end
    
    # Check each Slack channel analysis
    results = {}
    for analysis in slack_analyses:
        channel_id = analysis.resource_id
        
        # Get the channel name for better logging
        channel_result = await db.execute(sa.select(SlackChannel).where(SlackChannel.id == channel_id))
        channel = channel_result.scalar_one_or_none()
        channel_name = channel.name if channel else f"Unknown channel {channel_id}"
        channel_slack_id = channel.slack_id if channel else "Unknown"
        
        logger.info(f"\n{'=' * 50}")
        logger.info(f"Checking channel: {channel_name} (ID: {channel_id}, Slack ID: {channel_slack_id})")
        
        # Count actual messages in the database
        db_count = await count_channel_messages(db, channel_id, start_date, end_date)
        
        # Count messages without user_id
        no_user_count = await count_messages_without_user(db, channel_id, start_date, end_date)
        
        # Count system messages (messages containing "has joined the channel" or similar)
        system_count = await count_system_messages(db, channel_id, start_date, end_date)
        
        # Get the number of messages processed in the analysis
        analysis_count = 0
        prepared_count = 0
        if analysis.results:
            if "metadata" in analysis.results:
                metadata = analysis.results.get("metadata", {})
                analysis_count = metadata.get("message_count", 0)
            
            # Check if analysis contains no_data flag
            no_data = analysis.results.get("no_data", False)
            if no_data:
                logger.warning(f"Analysis has no_data=True flag despite having {db_count} messages in DB")
            
            # Try to get prepared data from the results if available
            # The ResourceAnalysis model doesn't have a prepared_data attribute 
            # but we might be able to infer it from other fields
            total_messages = analysis.results.get("total_messages", 0)
            if total_messages > 0:
                prepared_count = total_messages
        
        # Log the results
        logger.info(
            f"Message counts:\n"
            f"  Database total: {db_count} messages\n"
            f"  Without user_id: {no_user_count} messages\n"
            f"  System messages: {system_count} messages\n"
            f"  Prepared for LLM: {prepared_count} messages\n"
            f"  Analysis processed: {analysis_count} messages"
        )
        
        # Calculate the difference
        diff = db_count - analysis_count
        if diff != 0:
            logger.warning(
                f"Discrepancy in channel {channel_name}: "
                f"Missing {diff} messages in analysis"
            )
        
        # Get some sample messages to understand content
        sample_messages = await get_sample_messages(db, channel_id, start_date, end_date)
        logger.info(f"Sample messages ({len(sample_messages)}):")
        for i, msg in enumerate(sample_messages):
            truncated_text = msg.text[:100] + "..." if len(msg.text) > 100 else msg.text
            logger.info(f"  {i+1}. {msg.message_datetime} | User: {msg.user_id} | Text: '{truncated_text}'")
            
        # Store results    
        results[str(channel_id)] = {
            "channel_name": channel_name,
            "database_count": db_count,
            "no_user_count": no_user_count,
            "system_count": system_count,
            "prepared_count": prepared_count,
            "analysis_count": analysis_count,
            "difference": diff,
        }
    
    return results


async def count_messages_without_user(
    db: AsyncSession,
    channel_id: UUID,
    start_date: datetime,
    end_date: datetime,
) -> int:
    """Count messages without a user_id in a channel within a date range."""
    # Make sure dates are naive
    if start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
        
    result = await db.execute(
        sa.select(sa.func.count())
        .select_from(SlackMessage)
        .where(
            SlackMessage.channel_id == channel_id,
            SlackMessage.message_datetime >= start_date,
            SlackMessage.message_datetime <= end_date,
            SlackMessage.user_id.is_(None)
        )
    )
    return result.scalar_one()


async def count_system_messages(
    db: AsyncSession,
    channel_id: UUID,
    start_date: datetime,
    end_date: datetime,
) -> int:
    """Count system messages in a channel within a date range."""
    # Make sure dates are naive
    if start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
        
    result = await db.execute(
        sa.select(sa.func.count())
        .select_from(SlackMessage)
        .where(
            SlackMessage.channel_id == channel_id,
            SlackMessage.message_datetime >= start_date,
            SlackMessage.message_datetime <= end_date,
            sa.or_(
                SlackMessage.text.contains("has joined the channel"),
                SlackMessage.text.contains("has left the channel"),
                sa.and_(
                    SlackMessage.user_id.is_(None),
                    SlackMessage.text != ""
                )
            )
        )
    )
    return result.scalar_one()


async def get_sample_messages(
    db: AsyncSession,
    channel_id: UUID,
    start_date: datetime,
    end_date: datetime,
    limit: int = 5
) -> List[SlackMessage]:
    """Get sample messages from a channel within a date range."""
    # Make sure dates are naive
    if start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
        
    result = await db.execute(
        sa.select(SlackMessage)
        .where(
            SlackMessage.channel_id == channel_id,
            SlackMessage.message_datetime >= start_date,
            SlackMessage.message_datetime <= end_date
        )
        .order_by(SlackMessage.message_datetime.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def main() -> None:
    """Main entry point."""
    logger.info("Starting report consistency check")
    
    report_id = None
    if len(sys.argv) > 1:
        try:
            report_id = UUID(sys.argv[1])
        except ValueError:
            logger.error(f"Invalid report ID: {sys.argv[1]}")
            sys.exit(1)
    
    async with async_session() as db:
        if report_id:
            # Check a specific report
            logger.info(f"Checking report {report_id}")
            results = await check_report_consistency(db, report_id)
            
            # Print summary
            if results:
                total_db_messages = sum(r["database_count"] for r in results.values())
                total_analysis_messages = sum(r["analysis_count"] for r in results.values())
                
                logger.info("=" * 60)
                logger.info(f"Report {report_id} Summary:")
                logger.info(f"Total messages in database: {total_db_messages}")
                logger.info(f"Total messages processed in analyses: {total_analysis_messages}")
                logger.info(f"Difference: {total_db_messages - total_analysis_messages}")
                
                # Print channels with discrepancies
                discrepancies = {k: v for k, v in results.items() if v["difference"] != 0}
                if discrepancies:
                    logger.warning(f"Found {len(discrepancies)} channels with discrepancies:")
                    for channel_id, data in discrepancies.items():
                        logger.warning(
                            f"  {data['channel_name']}: missing {data['difference']} messages"
                        )
                else:
                    logger.info("All channels have consistent message counts!")
                
                logger.info("=" * 60)
            
        else:
            # Check recent reports
            logger.info("Checking recent reports")
            reports = await get_recent_reports(db)
            
            if not reports:
                logger.info("No reports found")
                return
            
            logger.info(f"Found {len(reports)} recent reports")
            for report in reports:
                logger.info(f"Checking report {report.id} ({report.title})")
                results = await check_report_consistency(db, report.id)
                
                # Print summary
                if results:
                    total_db_messages = sum(r["database_count"] for r in results.values())
                    total_analysis_messages = sum(r["analysis_count"] for r in results.values())
                    
                    logger.info("-" * 60)
                    logger.info(f"Report {report.id} Summary:")
                    logger.info(f"Total messages in database: {total_db_messages}")
                    logger.info(f"Total messages processed in analyses: {total_analysis_messages}")
                    logger.info(f"Difference: {total_db_messages - total_analysis_messages}")
                    
                    # Print channels with discrepancies
                    discrepancies = {k: v for k, v in results.items() if v["difference"] != 0}
                    if discrepancies:
                        logger.warning(f"Found {len(discrepancies)} channels with discrepancies")
                    else:
                        logger.info("All channels have consistent message counts!")
                    
                    logger.info("-" * 60)


if __name__ == "__main__":
    asyncio.run(main())