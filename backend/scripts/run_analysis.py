#!/usr/bin/env python3
"""
Script to run an analysis on a specific channel or set of channels.
This helps diagnose issues with the analysis pipeline, particularly for issue #238.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID, uuid4

import uvloop
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload, sessionmaker
from sqlalchemy.orm import selectinload, sessionmaker

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Mock the settings to avoid configuration errors
os.environ["SECRET_KEY"] = "debug_secret_key"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://toban_admin:postgres@localhost:5432/tobancv"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_KEY"] = "debug_key"
os.environ["SUPABASE_JWT_SECRET"] = "debug_jwt_secret"
os.environ["OPENAI_API_KEY"] = "debug_openai_key"
os.environ["OPENROUTER_API_KEY"] = "debug_openrouter_key"

from app.models.integration import Integration
from app.models.reports.cross_resource_report import CrossResourceReport, ResourceAnalysis
from app.models.slack import SlackChannel, SlackMessage, SlackUser, SlackWorkspace
from app.services.analysis.slack_channel import SlackChannelAnalysisService
from app.services.llm.openrouter import OpenRouterService

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler("debug_analysis.log")],
)

# Set up module-specific loggers
logger = logging.getLogger(__name__)
slack_logger = logging.getLogger("app.services.slack.messages")
analysis_logger = logging.getLogger("app.services.analysis.slack_channel")
llm_logger = logging.getLogger("app.services.llm.openrouter")

# Set all loggers to DEBUG
for module_logger in [slack_logger, analysis_logger, llm_logger]:
    module_logger.setLevel(logging.DEBUG)

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


async def get_channel_by_name(db: AsyncSession, channel_name: str) -> Optional[SlackChannel]:
    """Get a Slack channel by name."""
    result = await db.execute(select(SlackChannel).where(SlackChannel.name == channel_name))
    return result.scalar_one_or_none()


async def get_workspace_for_channel(db: AsyncSession, channel_id: UUID) -> Optional[SlackWorkspace]:
    """Get the workspace for a channel."""
    result = await db.execute(select(SlackChannel).where(SlackChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel or not channel.workspace_id:
        return None

    result = await db.execute(select(SlackWorkspace).where(SlackWorkspace.id == channel.workspace_id))
    return result.scalar_one_or_none()


async def get_integration_for_workspace(db: AsyncSession, workspace_slack_id: str) -> Optional[Integration]:
    """Get the integration for a workspace by Slack ID."""
    result = await db.execute(select(Integration).where(Integration.workspace_id == workspace_slack_id))
    return result.scalar_one_or_none()


async def run_debug_analysis(
    db: AsyncSession,
    channel_name: str,
    start_date: datetime,
    end_date: datetime,
    analysis_type: str = AnalysisType.ACTIVITY,  # Changed from GENERAL to ACTIVITY
    include_threads: bool = True,
    message_limit: int = 0,  # 0 means no limit
    dry_run: bool = False,
) -> None:
    """Run a debug analysis on a channel."""
    logger.info(f"Running debug analysis for channel {channel_name}")
    logger.info(f"Date range: {start_date} to {end_date}")
    logger.info(f"Analysis type: {analysis_type}")

    # Get the channel
    channel = await get_channel_by_name(db, channel_name)
    if not channel:
        logger.error(f"Channel {channel_name} not found")
        return

    logger.info(f"Found channel: {channel.name} (ID: {channel.id}, Slack ID: {channel.slack_id})")

    # Get the workspace
    workspace = await get_workspace_for_channel(db, channel.id)
    if not workspace:
        logger.error(f"Workspace not found for channel {channel_name}")
        return

    logger.info(f"Workspace: {workspace.name} (ID: {workspace.id}, Slack ID: {workspace.slack_id})")

    # Get the integration
    integration = await get_integration_for_workspace(db, workspace.slack_id)
    if not integration:
        logger.error(f"Integration not found for workspace {workspace.name}")
        return

    logger.info(f"Integration: {integration.name} (ID: {integration.id})")

    # Debug patch: Add proper monkeypatch logging to the OpenRouterService
    original_format_messages = OpenRouterService._format_messages

    def debug_format_messages(self, messages_data, max_tokens=None):
        """Debug wrapper for _format_messages to log the message processing."""
        # Check if messages_data is a dict or a list (handle both formats)
        if isinstance(messages_data, dict):
            messages = messages_data.get("messages", [])
            logger.debug(f"_format_messages called with {len(messages)} messages (dict format)")
            sample_messages = messages[:5]
        else:
            # If it's a list, it's already the messages
            messages = messages_data
            logger.debug(f"_format_messages called with {len(messages)} messages (list format)")
            sample_messages = messages[:5] if messages else []

        logger.debug(f"Sample messages: {json.dumps(sample_messages, indent=2)}")

        # Count messages with system text
        system_count = 0
        system_count = 0
        join_count = 0
        empty_count = 0
        for msg in messages:
            if "さんがチャンネルに参加しました" in msg.get("text", ""):
                join_count += 1
            if not msg.get("text"):
                empty_count += 1

        if join_count > 0:
            logger.warning(f"Found {join_count} join messages out of {len(messages)} total messages")
        if empty_count > 0:
            logger.warning(f"Found {empty_count} empty messages out of {len(messages)} total messages")

        # Call the original function
        result = original_format_messages(self, messages_data, max_tokens)
        logger.debug(f"_format_messages result content length: {len(result) if result else 0}")
        return result

    # Apply the monkeypatch
    OpenRouterService._format_messages = debug_format_messages

    # Debug patch for analyze_channel_messages to avoid making the actual API call
    original_analyze = OpenRouterService.analyze_channel_messages

    async def debug_analyze_channel_messages(
        self, channel_name, messages_data, start_date=None, end_date=None, model=None
    ):
        """Debug wrapper to skip the actual LLM API call."""
        logger.debug(f"analyze_channel_messages called for {channel_name}")

        # Format the messages to check for content
        message_content = self._format_messages(
            messages_data.get("messages", []) if isinstance(messages_data, dict) else messages_data
        )

        logger.debug(f"Message content preview: {message_content[:100]} (length: {len(message_content)})")

        # Count types of messages
        messages_list = messages_data.get("messages", []) if isinstance(messages_data, dict) else messages_data
        user_messages = [
            msg
            for msg in messages_list
            if msg.get("user") != "System" and "さんがチャンネルに参加しました" not in msg.get("text", "")
        ]
        system_messages = [
            msg
            for msg in messages_list
            if msg.get("user") == "System" or "さんがチャンネルに参加しました" in msg.get("text", "")
        ]

        logger.debug(f"Message counts: {len(user_messages)} user messages, {len(system_messages)} system messages")

        if len(user_messages) == 0:
            logger.warning("No user messages found - LLM will likely report 'no actual channel messages'")

        if dry_run:
            # Return mock response for dry run
            return {
                "channel_summary": "Debug run - no API call made",
                "key_highlights": "This is a debug dry run to check message processing",
                "contributor_insights": f"Found {len(user_messages)} user messages out of {len(messages_list)} total messages",
                "topic_analysis": "Debug run",
            }
        else:
            # Call the original method for real runs
            return await original_analyze(self, channel_name, messages_data, start_date, end_date, model)

    # Apply the second monkeypatch
    OpenRouterService.analyze_channel_messages = debug_analyze_channel_messages

    # Initialize the analysis service
    llm_client = OpenRouterService()
    analysis_service = SlackChannelAnalysisService(db, llm_client)

    # Set up parameters
    parameters = {
        "include_threads": include_threads,
        "message_limit": message_limit,
        "dry_run": dry_run,
    }

    try:
        # Fetch data
        logger.info("Fetching channel data...")
        data = await analysis_service.fetch_data(
            resource_id=channel.id,
            start_date=start_date,
            end_date=end_date,
            integration_id=integration.id,
            parameters=parameters,
        )

        # Log statistics
        logger.info(f"Retrieved {len(data['messages'])} messages")
        logger.info(f"User count: {len(data['users'])}")
        logger.info(f"Thread count: {data['metadata']['thread_count']}")

        # Debug check: Let's look at a few message samples
        logger.info("Sample messages:")
        for i, msg in enumerate(data["messages"][:5]):
            logger.info(f"  {i + 1}. {msg['timestamp']} | User: {msg['user_id']} | Text: '{msg['text'][:100]}...'")
            logger.info(
                f"     Thread info: parent={msg['is_thread_parent']}, reply={msg['is_thread_reply']}, replies={msg['reply_count']}"
            )

        # Prepare data for analysis
        logger.info("Preparing data for analysis...")
        prepared_data = await analysis_service.prepare_data_for_analysis(data, analysis_type)

        # Log prepared data statistics
        logger.info(f"Prepared data: {prepared_data['total_messages']} total messages")

        if analysis_type == AnalysisType.ACTIVITY:
            logger.info(f"Prepared {len(prepared_data.get('messages', []))} messages for LLM")
            sample_prepared = prepared_data.get("messages", [])[:3]
            logger.info(f"Sample prepared messages: {json.dumps(sample_prepared, indent=2)}")

        # Run the analysis
        logger.info("Running analysis...")
        analysis_results = await analysis_service.analyze_data(
            data=prepared_data,
            analysis_type=analysis_type,
            parameters=parameters,
        )

        # Log results
        if dry_run:
            logger.info("Dry run completed - No LLM call made")
        else:
            logger.info("Analysis completed")
            logger.info(f"Resource summary: {analysis_results.get('resource_summary', '')[:200]}...")
            logger.info(f"Key highlights: {analysis_results.get('key_highlights', '')[:200]}...")

            # Check for no_data flag
            if analysis_results.get("no_data", False):
                logger.error("LLM reported no_data=True despite having messages in the data")

    except Exception as e:
        logger.error(f"Error running analysis: {str(e)}")
        import traceback

        traceback.print_exc()


async def create_debug_cross_report(
    db: AsyncSession,
    channel_names: List[str],
    start_date: datetime,
    end_date: datetime,
    analysis_type: str = AnalysisType.ACTIVITY,
    title: str = None,
) -> Optional[UUID]:
    """Create a cross-resource report for debugging."""
    logger.info(f"Creating cross-resource report for channels: {', '.join(channel_names)}")
    logger.info(f"Date range: {start_date} to {end_date}")

    # Get the channels
    channels = []
    for name in channel_names:
        channel = await get_channel_by_name(db, name)
        if not channel:
            logger.error(f"Channel {name} not found")
            continue
        channels.append(channel)

    if not channels:
        logger.error("No valid channels found")
        return None

    # Generate a title if not provided
    if not title:
        title = f"Debug Multi-channel Analysis ({len(channels)} channels)"

    # Create the report
    report = CrossResourceReport(
        id=uuid4(),
        title=title,
        date_range_start=start_date,
        date_range_end=end_date,
        created_at=datetime.now(timezone.utc),
        status="pending",
    )

    db.add(report)

    # Create resource analyses
    for channel in channels:
        # Get the workspace
        workspace = await get_workspace_for_channel(db, channel.id)
        if not workspace:
            logger.error(f"Workspace not found for channel {channel.name}")
            continue

        # Get the integration
        integration = await get_integration_for_workspace(db, workspace.slack_id)
        if not integration:
            logger.error(f"Integration not found for workspace {workspace.name}")
            continue

        analysis = ResourceAnalysis(
            id=uuid4(),
            cross_resource_report_id=report.id,
            resource_id=channel.id,
            resource_type=AnalysisType.SLACK_CHANNEL,
            integration_id=integration.id,
            analysis_type=analysis_type,
            created_at=datetime.now(timezone.utc),
            status="pending",
        )

        db.add(analysis)

    await db.commit()
    logger.info(f"Created cross-resource report {report.id}")
    return report.id


async def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print("Usage: python run_analysis.py <command> [args]")
        print()
        print("Commands:")
        print("  analyze <channel_name> <start_date> <end_date> [analysis_type]")
        print("    Run analysis on a single channel")
        print()
        print("  create-report <channel1,channel2,...> <start_date> <end_date> [analysis_type]")
        print("    Create a cross-resource report for multiple channels")
        print()
        print("Examples:")
        print("  python run_analysis.py analyze proj-oss-boardgame 2024-11-01 2025-04-24 general")
        print("  python run_analysis.py create-report 'proj-oss-boardgame,02_introduction' 2024-11-01 2025-04-24")
        return

    command = sys.argv[1]

    async with async_session() as db:
        if command == "analyze" and len(sys.argv) >= 5:
            channel_name = sys.argv[2]
            start_date = datetime.fromisoformat(sys.argv[3])
            end_date = datetime.fromisoformat(sys.argv[4])
            analysis_type = sys.argv[5] if len(sys.argv) > 5 else AnalysisType.ACTIVITY

            await run_debug_analysis(
                db=db,
                channel_name=channel_name,
                start_date=start_date,
                end_date=end_date,
                analysis_type=analysis_type,
            )

        elif command == "create-report" and len(sys.argv) >= 5:
            channel_names = sys.argv[2].split(",")
            start_date = datetime.fromisoformat(sys.argv[3])
            end_date = datetime.fromisoformat(sys.argv[4])
            analysis_type = sys.argv[5] if len(sys.argv) > 5 else AnalysisType.ACTIVITY

            report_id = await create_debug_cross_report(
                db=db,
                channel_names=channel_names,
                start_date=start_date,
                end_date=end_date,
                analysis_type=analysis_type,
            )

            if report_id:
                logger.info(f"Created cross-resource report with ID: {report_id}")
                logger.info("Use this ID to monitor the report status and results")

        else:
            logger.error(f"Unknown command: {command}")
            logger.info("Use 'python run_analysis.py' without arguments to see usage")


if __name__ == "__main__":
    uvloop.install()
    asyncio.run(main())
