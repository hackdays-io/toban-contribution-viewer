"""Slack channel analysis service."""

import logging
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration
from app.models.reports import AnalysisType
from app.models.slack import SlackChannel, SlackUser
from app.services.analysis.base import ResourceAnalysisService
from app.services.llm.openrouter import OpenRouterService
from app.services.slack.messages import SlackMessageService, get_channel_messages

logger = logging.getLogger(__name__)


class SlackChannelAnalysisService(ResourceAnalysisService):
    """
    Service for analyzing Slack channels.
    """

    def __init__(
        self, db: AsyncSession, llm_client: Optional[OpenRouterService] = None
    ):
        """
        Initialize with a database session and optional LLM client.

        Args:
            db: Database session
            llm_client: OpenRouter service for LLM analysis (will create if None)
        """
        super().__init__(db)
        self.llm_client = llm_client or OpenRouterService()
        self.message_service = SlackMessageService()

    async def fetch_data(
        self,
        resource_id: UUID,
        start_date: datetime,
        end_date: datetime,
        integration_id: UUID = None,
        parameters: Dict[str, Any] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Fetch data for a Slack channel within a date range.

        Args:
            resource_id: Channel ID to analyze
            start_date: Start date for the analysis period
            end_date: End date for the analysis period
            integration_id: Integration ID for the Slack workspace
            parameters: Additional parameters for data fetching
            kwargs: Additional arguments

        Returns:
            Dictionary containing channel data, messages, and users
        """
        logger.info(f"Fetching data for Slack channel {resource_id}")

        # Get the Slack channel
        channel_result = await self.db.execute(
            select(SlackChannel).where(SlackChannel.id == resource_id)
        )
        channel = channel_result.scalar_one_or_none()

        if not channel:
            logger.error(f"Channel {resource_id} not found")
            raise ValueError(f"Channel {resource_id} not found")

        # Get the integration (Slack workspace)
        integration_result = await self.db.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        integration = integration_result.scalar_one_or_none()

        if not integration:
            logger.error(f"Integration {integration_id} not found")
            raise ValueError(f"Integration {integration_id} not found")

        # Extract parameters
        include_threads = (
            parameters.get("include_threads", True) if parameters else True
        )
        message_limit = parameters.get("message_limit", 1000) if parameters else 1000

        # Get messages within the date range
        # First, we need to get the SlackWorkspace.id using the integration.workspace_id
        if not integration.workspace_id:
            logger.error(f"Integration {integration_id} has no workspace_id")
            raise ValueError(f"Integration {integration_id} has no workspace_id")
            
        # Query the SlackWorkspace table to get the workspace by slack_id
        from app.models.slack import SlackWorkspace
        workspace_result = await self.db.execute(
            select(SlackWorkspace).where(SlackWorkspace.slack_id == integration.workspace_id)
        )
        workspace = workspace_result.scalar_one_or_none()
        
        if not workspace:
            logger.error(f"SlackWorkspace not found with slack_id={integration.workspace_id}")
            raise ValueError(f"SlackWorkspace not found with slack_id={integration.workspace_id}")
        
        # Now we have the correct workspace ID (UUID) to use with get_channel_messages
        workspace_id = str(workspace.id)
        
        logger.info(f"Fetching messages for SlackWorkspace.id={workspace_id}, " 
                   f"channel_id={resource_id}, integration_id={integration_id}")
        logger.info(f"Integration.workspace_id (Slack ID): {integration.workspace_id}")
        logger.info(f"Date range: {start_date} to {end_date}")
            
        messages = await get_channel_messages(
            db=self.db,
            workspace_id=workspace_id,
            channel_id=str(resource_id),
            start_date=start_date,
            end_date=end_date,
            include_replies=include_threads,
            limit=message_limit,
        )
        
        logger.info(f"Retrieved {len(messages)} messages from channel {resource_id}")

        # Get users who have sent messages in this channel
        user_ids = list(set(msg.user_id for msg in messages if msg.user_id))
        users_result = await self.db.execute(
            select(SlackUser).where(SlackUser.id.in_(user_ids))
        )
        users = users_result.scalars().all()

        # Compile all data
        return {
            "channel": {
                "id": str(channel.id),
                "name": channel.name,
                "slack_id": channel.slack_id,
                "type": channel.type,
                "purpose": channel.purpose,
                "topic": channel.topic,
                "member_count": channel.member_count,
                "workspace_name": integration.name,
            },
            "messages": [
                {
                    "id": str(msg.id),
                    "user_id": str(msg.user_id) if msg.user_id else None,
                    "text": msg.text,
                    "thread_ts": msg.thread_ts,
                    "is_thread_parent": msg.is_thread_parent,
                    "is_thread_reply": msg.is_thread_reply,
                    "reply_count": msg.reply_count,
                    "reaction_count": msg.reaction_count,
                    "timestamp": msg.message_datetime.isoformat(),
                    "has_attachments": msg.has_attachments,
                }
                for msg in messages
            ],
            "users": [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "display_name": user.display_name or user.name,
                    "real_name": user.real_name,
                    "is_bot": user.is_bot,
                    "title": user.title,
                }
                for user in users
            ],
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "metadata": {
                "message_count": len(messages),
                "user_count": len(users),
                "thread_count": sum(1 for msg in messages if msg.is_thread_parent),
                "parameters": parameters or {},
            },
        }

    async def prepare_data_for_analysis(
        self, data: Dict[str, Any], analysis_type: str
    ) -> Dict[str, Any]:
        """
        Process raw Slack channel data into a format suitable for LLM analysis.

        Args:
            data: Raw channel data
            analysis_type: Type of analysis to perform

        Returns:
            Processed data ready for LLM analysis
        """
        logger.info(f"Preparing Slack channel data for {analysis_type} analysis")
        
        # Filter out system messages before processing
        # Issue #238: Many channels only contain system messages which aren't useful for analysis
        filtered_messages = []
        system_message_count = 0
        empty_message_count = 0
        join_message_count = 0
        non_text_message_count = 0
        
        for msg in data["messages"]:
            text = msg["text"]
            has_user_id = bool(msg["user_id"])
            
            # Skip messages about users joining channels or other system notifications
            if "さんがチャンネルに参加しました" in text or "has joined the channel" in text:
                join_message_count += 1
                continue
            
            # Skip system notifications about users leaving
            if "さんがチャンネルから退出しました" in text or "has left the channel" in text:
                join_message_count += 1  # Count under the same category
                continue 
                
            # Skip empty messages
            if not text.strip():
                empty_message_count += 1
                continue
            
            # Skip system messages without user_id
            if not has_user_id:
                system_message_count += 1
                continue
            
            # Check for messages that only contain non-latin characters (might cause issues for LLM)
            if text and all(ord(c) > 127 for c in text.strip()):
                # Count it but still include it - just for tracking
                non_text_message_count += 1
                
            # Include this message for analysis
            filtered_messages.append(msg)
        
        # Log filtering results for debugging
        original_count = len(data["messages"])
        filtered_count = len(filtered_messages)
        logger.info(f"Filtered messages: {original_count} → {filtered_count} "
                   f"(removed {join_message_count} join/leave messages, "
                   f"{empty_message_count} empty messages, "
                   f"{system_message_count} system messages, "
                   f"kept {non_text_message_count} non-Latin text messages)")
        
        # Update the messages and counts in the data
        data["messages"] = filtered_messages
        data["metadata"]["message_count"] = filtered_count
        
        # Basic channel info is always included
        prepared_data = {
            "channel_name": data["channel"]["name"],
            "channel_purpose": data["channel"]["purpose"],
            "channel_topic": data["channel"]["topic"],
            "channel_type": data["channel"]["type"],
            "workspace_name": data["channel"]["workspace_name"],
            "period_start": data["period"]["start"],
            "period_end": data["period"]["end"],
            "total_messages": data["metadata"]["message_count"],
            "total_users": data["metadata"]["user_count"],
            "total_threads": data["metadata"]["thread_count"],
        }

        # Build a user lookup dictionary
        user_lookup = {user["id"]: user for user in data["users"]}

        # Process messages differently based on analysis type
        if analysis_type == AnalysisType.CONTRIBUTION:
            # For contribution analysis, we need user-centric data
            user_stats = {}

            for msg in data["messages"]:
                user_id = msg["user_id"]
                if not user_id:
                    continue  # Skip system messages

                if user_id not in user_stats:
                    user_stats[user_id] = {
                        "message_count": 0,
                        "thread_replies": 0,
                        "thread_parents": 0,
                        "reactions_received": 0,
                        "user_info": user_lookup.get(
                            user_id, {"name": "Unknown", "is_bot": False}
                        ),
                    }

                # Update stats
                user_stats[user_id]["message_count"] += 1
                if msg["is_thread_reply"]:
                    user_stats[user_id]["thread_replies"] += 1
                if msg["is_thread_parent"]:
                    user_stats[user_id]["thread_parents"] += 1
                user_stats[user_id]["reactions_received"] += msg["reaction_count"]

            prepared_data["user_contributions"] = user_stats

        elif analysis_type == AnalysisType.TOPICS:
            # For topic analysis, we focus on the message content
            # Prepare message content, skipping bot messages if needed
            messages_for_analysis = []
            for msg in data["messages"]:
                user_id = msg["user_id"]
                is_bot = (
                    user_lookup.get(user_id, {}).get("is_bot", False)
                    if user_id
                    else False
                )

                if not is_bot:  # Skip bot messages for topic analysis
                    message_data = {
                        "text": msg["text"],
                        "user": (
                            user_lookup.get(user_id, {}).get("display_name", "Unknown")
                            if user_id
                            else "Unknown"
                        ),
                        "timestamp": msg["timestamp"],
                        "is_thread": msg["is_thread_parent"] or msg["is_thread_reply"],
                    }
                    messages_for_analysis.append(message_data)

            # Group messages by date for better topic analysis
            from collections import defaultdict
            from datetime import datetime

            date_grouped_messages = defaultdict(list)
            for msg in messages_for_analysis:
                date_str = datetime.fromisoformat(msg["timestamp"]).strftime("%Y-%m-%d")
                date_grouped_messages[date_str].append(msg)

            prepared_data["messages_by_date"] = dict(date_grouped_messages)

        else:
            # For general analysis or other types, include processed messages
            messages_for_analysis = []
            for msg in data["messages"]:
                user_id = msg["user_id"]
                if user_id:
                    user_name = user_lookup.get(user_id, {}).get(
                        "display_name", "Unknown"
                    )
                else:
                    user_name = "System"

                message_data = {
                    "text": msg["text"],
                    "user": user_name,
                    "timestamp": msg["timestamp"],
                    "is_thread_parent": msg["is_thread_parent"],
                    "is_thread_reply": msg["is_thread_reply"],
                    "reply_count": msg["reply_count"],
                    "reaction_count": msg["reaction_count"],
                }
                messages_for_analysis.append(message_data)

            prepared_data["messages"] = messages_for_analysis

        return prepared_data

    async def analyze_data(
        self,
        data: Dict[str, Any],
        analysis_type: str,
        parameters: Dict[str, Any] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Analyze Slack channel data using LLM.

        Args:
            data: Processed channel data
            analysis_type: Type of analysis to perform
            parameters: Additional parameters for the analysis
            kwargs: Additional parameters

        Returns:
            Analysis results from the LLM
        """
        logger.info(f"Analyzing Slack channel data for {analysis_type} analysis")
        
        # Check if there's enough data to analyze
        total_messages = data.get("total_messages", 0)
        channel_name = data.get("channel_name", "Unknown channel")
        logger.info(f"Channel {channel_name} has {total_messages} messages to analyze")
        
        if total_messages == 0:
            logger.warning(f"No messages found for analysis in {channel_name}")
            # Return empty analysis with explanation
            return {
                "resource_summary": "No messages were found in this channel during the specified time period. This could be because the channel is inactive, or because the date range was too narrow. Note that system messages like 'user joined the channel' notifications are filtered out automatically.",
                "key_highlights": "No activity to highlight in this time period.",
                "contributor_insights": "No user activity to analyze in this time period.",
                "topic_analysis": "No discussion topics found in this time period.",
                "model_used": "N/A - No data to analyze",
                "analysis_type": analysis_type,
                "channel_name": channel_name,
                "timestamp": datetime.utcnow().isoformat(),
                "no_data": True
            }

        # Continue with normal analysis if we have messages
        # Choose the prompt template based on analysis type
        prompt_template = self.get_prompt_template(analysis_type)

        # Set model parameters
        model_params = parameters.get("model_params", {}) if parameters else {}
        default_model = "anthropic/claude-3-opus-20240229"
        model = model_params.get("model", default_model)

        # Create a context string from the data
        context = self.create_context_for_llm(data, analysis_type)

        # Format the prompt using standard string formatting
        try:
            # Direct string formatting with named parameters
            prompt = prompt_template.format(
                channel_name=context.get("channel_name", "Unknown channel"),
                channel_purpose=context.get("channel_purpose", "No purpose specified"),
                channel_topic=context.get("channel_topic", "No topic specified"),
                workspace_name=context.get("workspace_name", "Unknown workspace"),
                period_start=context.get("period_start", "Unknown"),
                period_end=context.get("period_end", "Unknown"),
                total_messages=context.get("total_messages", 0),
                total_users=context.get("total_users", 0),
                total_threads=context.get("total_threads", 0),
                user_contributions_text=context.get("user_contributions_text", "No user contributions data available."),
                messages_by_date_text=context.get("messages_by_date_text", "No messages data available."),
                messages_sample_text=context.get("messages_sample_text", "No message samples available.")
            )
            logger.info(f"Successfully formatted prompt template for {analysis_type} analysis")
        except KeyError as e:
            logger.error(f"KeyError formatting prompt template: {e}")
            # Fall back to a simpler prompt with just the available information
            prompt = f"""
            You are a Slack channel analyst. You're analyzing the Slack channel '{channel_name}'.
            
            Time period: {context.get('period_start', 'Unknown')} to {context.get('period_end', 'Unknown')}
            
            Total messages: {total_messages}
            Total users: {context.get('total_users', 0)}
            Total threads: {context.get('total_threads', 0)}
            
            Please analyze this channel data and provide insights on activity, contributors, and topics.
            """
            logger.info("Using fallback prompt due to template formatting error")
        except Exception as e:
            logger.error(f"Error formatting prompt template: {e}")
            raise ValueError(f"Error preparing analysis prompt: {str(e)}")
            
        # Prepare message data for the LLM
        message_data = {
            "messages": [
                {
                    "text": prompt,
                    "user_name": "System",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ],
            "message_count": 1,
            "participant_count": 1,
            "thread_count": 0,
            "reaction_count": 0,
        }

        # Check if this is a dry run (for testing prompt formatting)
        if parameters and parameters.get("dry_run"):
            logger.info("Dry run mode - skipping LLM API call")
            return {
                "resource_summary": "Dry run - prompt formatting successful",
                "key_highlights": "Dry run - no LLM call made",
                "contributor_insights": "Dry run - testing only",
                "topic_analysis": "Dry run - testing only",
                "model_used": model,
                "analysis_type": analysis_type,
                "channel_name": data.get("channel_name", "Unknown channel"),
                "timestamp": datetime.utcnow().isoformat(),
                "dry_run": True
            }
            
        # Call the LLM API using the OpenRouterService interface
        response = await self.llm_client.analyze_channel_messages(
            channel_name=data.get("channel_name", "Unknown channel"),
            messages_data=message_data,
            start_date=data.get("period_start", datetime.utcnow().isoformat()),
            end_date=data.get("period_end", datetime.utcnow().isoformat()),
            model=model,
        )

        # Parse the LLM response
        parsed_response = self.parse_llm_response(response, analysis_type)

        # Log the raw response for debugging issue #238
        logger.info(f"LLM raw response: {response.get('channel_summary', '')[:200]}...")
        
        # Check if the response mentions "no actual channel messages"
        if "no actual channel messages" in response.get("channel_summary", "").lower():
            logger.error(f"LLM reports 'no actual channel messages' despite {total_messages} messages being sent")
            logger.info(f"This indicates the LLM doesn't recognize the message content as meaningful conversation")
            
            # Check the first few messages to see what might be wrong
            messages_list = data.get("messages", [])
            if messages_list:
                logger.info(f"Sample of messages being sent to LLM:")
                for i, msg in enumerate(messages_list[:5]):
                    logger.info(f"  {i+1}. User: {msg.get('user', 'Unknown')} | Text: {msg.get('text', '')[:100]}")
            
            # Add debugging info to the response
            parsed_response["debug_info"] = {
                "total_messages_sent": total_messages,
                "raw_response_fragment": response.get("channel_summary", "")[:200],
                "mentions_no_messages": True
            }

        # Add metadata to the results
        parsed_response["model_used"] = model
        parsed_response["analysis_type"] = analysis_type
        parsed_response["channel_name"] = data.get("channel_name", "Unknown channel")
        parsed_response["timestamp"] = datetime.utcnow().isoformat()

        return parsed_response

    def get_prompt_template(self, analysis_type: str) -> str:
        """
        Get the appropriate prompt template for the given analysis type.

        Args:
            analysis_type: Type of analysis to perform

        Returns:
            Prompt template as a string
        """
        if analysis_type == AnalysisType.CONTRIBUTION:
            return """
            You are a Slack channel analyst. You're analyzing a Slack channel to understand user contributions.
            
            Channel: {channel_name}
            Purpose: {channel_purpose}
            Workspace: {workspace_name}
            Period: {period_start} to {period_end}
            
            Below is user contribution data showing each user's message count, thread activity, and reactions:
            
            {user_contributions_text}
            
            Please analyze this data and provide:
            
            1. CONTRIBUTOR_INSIGHTS: Identify key contributors and analyze contribution patterns. Who are the most active users?
               Who drives conversations through threads? Who receives the most engagement through reactions?
            
            2. KEY_HIGHLIGHTS: Notable contributions or patterns worth highlighting.
            
            3. RESOURCE_SUMMARY: A brief summary of the channel activity and contributions during this period.
            
            Format your response as a JSON object with these exact keys: "contributor_insights", "key_highlights", and "resource_summary".
            """

        elif analysis_type == AnalysisType.TOPICS:
            return """
            You are a Slack channel analyst. You're analyzing a Slack channel to identify discussion topics.
            
            Channel: {channel_name}
            Purpose: {channel_purpose}
            Workspace: {workspace_name}
            Period: {period_start} to {period_end}
            
            Below are messages grouped by date:
            
            {messages_by_date_text}
            
            Please analyze these messages and provide:
            
            1. TOPIC_ANALYSIS: Identify the main topics discussed in this channel. What themes emerge? How do topics evolve over time?
               Categorize discussions and provide examples of key conversations.
            
            2. KEY_HIGHLIGHTS: Important discussions, decisions, or announcements worth highlighting.
            
            3. RESOURCE_SUMMARY: A brief summary of what this channel is used for based on the message content.
            
            Format your response as a JSON object with these exact keys: "topic_analysis", "key_highlights", and "resource_summary".
            """

        else:  # General activity analysis or fallback
            return """
            You are a Slack channel analyst. You're analyzing a Slack channel to provide a general activity summary.
            
            Channel: {channel_name}
            Purpose: {channel_purpose}
            Workspace: {workspace_name}
            Period: {period_start} to {period_end}
            
            Statistics:
            - Total messages: {total_messages}
            - Total users: {total_users}
            - Total threads: {total_threads}
            
            {messages_sample_text}
            
            Please analyze this data and provide:
            
            1. RESOURCE_SUMMARY: A comprehensive summary of the channel activity during this period. How active is the channel?
               What kind of communication happens here? What's the general atmosphere and purpose?
            
            2. KEY_HIGHLIGHTS: Notable events, spikes in activity, or important messages worth highlighting.
            
            3. CONTRIBUTOR_INSIGHTS: Brief insights about participation patterns.
            
            4. TOPIC_ANALYSIS: Brief insights about common topics discussed.
            
            Format your response as a JSON object with these exact keys: "resource_summary", "key_highlights", "contributor_insights", and "topic_analysis".
            """

    def create_context_for_llm(
        self, data: Dict[str, Any], analysis_type: str
    ) -> Dict[str, Any]:
        """
        Create a context dictionary for the LLM prompt.

        Args:
            data: Processed channel data
            analysis_type: Type of analysis to perform

        Returns:
            Context dictionary for the LLM prompt
        """
        context = {
            "channel_name": data.get("channel_name", "Unknown"),
            "channel_purpose": data.get("channel_purpose", "No purpose specified"),
            "channel_topic": data.get("channel_topic", "No topic specified"),
            "workspace_name": data.get("workspace_name", "Unknown workspace"),
            "period_start": data.get("period_start", "Unknown"),
            "period_end": data.get("period_end", "Unknown"),
            "total_messages": data.get("total_messages", 0),
            "total_users": data.get("total_users", 0),
            "total_threads": data.get("total_threads", 0),
        }

        if analysis_type == AnalysisType.CONTRIBUTION:
            # Format user contributions data
            user_contributions = data.get("user_contributions", {})
            user_lines = []

            for _user_id, stats in user_contributions.items():
                user_info = stats["user_info"]
                user_lines.append(
                    f"User: {user_info.get('display_name', user_info.get('name', 'Unknown'))}\n"
                    f"  Messages: {stats['message_count']}\n"
                    f"  Thread Replies: {stats['thread_replies']}\n"
                    f"  Thread Starters: {stats['thread_parents']}\n"
                    f"  Reactions Received: {stats['reactions_received']}\n"
                    f"  Is Bot: {user_info.get('is_bot', False)}\n"
                )

            context["user_contributions_text"] = "\n".join(user_lines)

        elif analysis_type == AnalysisType.TOPICS:
            # Format messages by date
            messages_by_date = data.get("messages_by_date", {})
            date_lines = []

            for date, messages in messages_by_date.items():
                date_lines.append(f"Date: {date} ({len(messages)} messages)")
                # Include a sample of messages for each date
                sample_size = min(10, len(messages))
                for _, msg in enumerate(messages[:sample_size]):
                    date_lines.append(f"  {msg['user']}: {msg['text']}")
                if len(messages) > sample_size:
                    date_lines.append(
                        f"  ... and {len(messages) - sample_size} more messages"
                    )
                date_lines.append("")  # Add a blank line between dates

            context["messages_by_date_text"] = "\n".join(date_lines)

        else:
            # For general analysis, include a sample of messages
            messages = data.get("messages", [])
            sample_size = min(50, len(messages))
            message_lines = [
                f"{msg['user']} ({msg['timestamp']}): {msg['text']}"
                for msg in messages[:sample_size]
            ]

            if len(messages) > sample_size:
                message_lines.append(
                    f"... and {len(messages) - sample_size} more messages"
                )

            context["messages_sample_text"] = "\n".join(message_lines)

        return context

    def parse_llm_response(
        self, response: Dict[str, Any], analysis_type: str
    ) -> Dict[str, Any]:
        """
        Parse the LLM response into structured data.

        Args:
            response: Analysis results from OpenRouterService
            analysis_type: Type of analysis that was performed

        Returns:
            Parsed response data
        """
        # Fix for issue #238: Handle case where the LLM response has empty sections
        # or indicates no messages were found despite messages being in the database
        
        # With OpenRouterService, the response is already partially structured
        # We'll adapt it to our expected format

        # Get the full response text for fallback parsing if needed
        content = response.get("channel_summary", "")
        
        # Check if the response mentions "no actual channel messages"
        if "no actual channel messages" in content.lower():
            logger.warning("LLM reported 'no actual channel messages' despite data being sent")
            logger.info("This may indicate a problem with message formatting or content")
            
            # Add a debug flag to the response to help troubleshoot
            response["_debug_no_messages_reported"] = True

        # Map the OpenRouterService response keys to our expected output
        result = {}

        if analysis_type == AnalysisType.CONTRIBUTION:
            result = {
                "contributor_insights": response.get("contributor_insights", ""),
                "key_highlights": response.get("key_highlights", ""),
                "resource_summary": response.get("channel_summary", ""),
                "full_response": content,
            }
        elif analysis_type == AnalysisType.TOPICS:
            result = {
                "topic_analysis": response.get("topic_analysis", ""),
                "key_highlights": response.get("key_highlights", ""),
                "resource_summary": response.get("channel_summary", ""),
                "full_response": content,
            }
        else:
            result = {
                "resource_summary": response.get("channel_summary", ""),
                "key_highlights": response.get("key_highlights", ""),
                "contributor_insights": response.get("contributor_insights", ""),
                "topic_analysis": response.get("topic_analysis", ""),
                "full_response": content,
            }

        # Try to extract JSON if we received content that might contain JSON
        if not any(result[k] for k in result if k != "full_response"):
            try:
                import json
                import re

                # Look for JSON-like structure in the response
                json_match = re.search(r"\{[\s\S]*\}", content)
                if json_match:
                    json_str = json_match.group(0)
                    parsed = json.loads(json_str)

                    # Add all keys from parsed JSON to result
                    for key, value in parsed.items():
                        result[key] = value
            except Exception as e:
                logger.warning(f"Failed to parse LLM response as JSON: {str(e)}")

                # If JSON parsing failed, try regex extraction as fallback
                import re

                # Define sections to extract based on analysis type
                sections = []
                if analysis_type == AnalysisType.CONTRIBUTION:
                    sections = [
                        "CONTRIBUTOR_INSIGHTS",
                        "KEY_HIGHLIGHTS",
                        "RESOURCE_SUMMARY",
                    ]
                elif analysis_type == AnalysisType.TOPICS:
                    sections = ["TOPIC_ANALYSIS", "KEY_HIGHLIGHTS", "RESOURCE_SUMMARY"]
                else:
                    sections = [
                        "RESOURCE_SUMMARY",
                        "KEY_HIGHLIGHTS",
                        "CONTRIBUTOR_INSIGHTS",
                        "TOPIC_ANALYSIS",
                    ]

                # Extract each section
                for i, section in enumerate(sections):
                    section_pattern = re.compile(
                        rf"{section}:?\s*(.*?)(?=\n\s*(?:{'|'.join(sections[i + 1:])})|$)",
                        re.DOTALL | re.IGNORECASE,
                    )
                    match = section_pattern.search(content)
                    if match:
                        # Convert section name to lowercase with underscores
                        key = section.lower()
                        result[key] = match.group(1).strip()

        return result
