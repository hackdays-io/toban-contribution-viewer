"""
OpenRouter API integration for LLM-powered analytics.

This module provides a service for interacting with OpenRouter API to get AI-powered
analysis of Slack communication data.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import httpx
from pydantic import BaseModel

from app.config import settings
from app.services.llm.prompt_templates import CHANNEL_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


class OpenRouterMessage(BaseModel):
    """Represents a message in the OpenRouter API format."""

    role: str
    content: str


class OpenRouterRequest(BaseModel):
    """Represents a request to the OpenRouter API."""

    model: str
    messages: List[OpenRouterMessage]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    response_format: Optional[Dict[str, str]] = None


class OpenRouterService:
    """Service for interacting with the OpenRouter API."""

    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    # Models known to support JSON mode
    JSON_MODE_SUPPORTED_MODELS = [
        "anthropic/claude-3",  # All Claude 3 models
        "openai/gpt-4",  # GPT-4 models
        "openai/gpt-3.5-turbo",
        "mistralai/mistral-large",
        "google/gemini-pro",
    ]

    def __init__(self):
        """Initialize the OpenRouter service with configuration from settings."""
        self.api_key = settings.OPENROUTER_API_KEY.get_secret_value() if settings.OPENROUTER_API_KEY else None
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set in environment variables")

        # Default configuration
        self.default_model = settings.OPENROUTER_DEFAULT_MODEL
        self.default_max_tokens = settings.OPENROUTER_MAX_TOKENS
        self.default_temperature = settings.OPENROUTER_TEMPERATURE

        # App info for OpenRouter headers
        self.app_name = "Toban Contribution Viewer"
        self.app_site = os.environ.get("SITE_DOMAIN", "toban-contribution-viewer.example.com")

    def _model_supports_json_mode(self, model: str) -> bool:
        """
        Check if the specified model supports JSON mode.

        Args:
            model: The model identifier

        Returns:
            True if the model supports JSON mode, False otherwise
        """
        return any(model.startswith(supported_model) for supported_model in self.JSON_MODE_SUPPORTED_MODELS)

    async def analyze_channel_messages(
        self,
        channel_name: str,
        messages_data: Dict[str, Any],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime],
        model: Optional[str] = None,
        use_json_mode: bool = True,
    ) -> Dict[str, str]:
        """
        Send channel messages to LLM for analysis and get structured insights.

        Args:
            channel_name: Name of the Slack channel
            messages_data: Dictionary containing message stats and content
            start_date: Start date for analysis period (ISO8601 string or datetime)
            end_date: End date for analysis period (ISO8601 string or datetime)
            model: Optional LLM model to use (falls back to default if not specified)
            use_json_mode: Whether to request a JSON-formatted response (default: True)

        Returns:
            Dictionary with analysis sections (channel_summary, topic_analysis, etc.)
        """
        # Import datetime for type checking
        from datetime import datetime as dt

        # Convert datetime to ISO string if needed
        start_date_str = start_date.isoformat() if isinstance(start_date, dt) else start_date
        end_date_str = end_date.isoformat() if isinstance(end_date, dt) else end_date

        # Prepare the context for the LLM
        message_count = messages_data.get("message_count", 0)
        participant_count = messages_data.get("participant_count", 0)
        thread_count = messages_data.get("thread_count", 0)
        reaction_count = messages_data.get("reaction_count", 0)

        # Add detailed logging for issue #238
        logger.info(f"Analyzing channel {channel_name} with {message_count} messages, {participant_count} participants")
        logger.info(f"Analysis period: {start_date} to {end_date}")

        # Check if the messages list matches the reported count
        messages_list = messages_data.get("messages", [])
        if len(messages_list) != message_count:
            logger.warning(f"Message count mismatch: reported {message_count} but list has {len(messages_list)}")

        # Check if we have actual messages to analyze after filtering
        if not messages_list:
            logger.warning(f"No messages provided for analysis of channel {channel_name}")

        # Fix for issue #238: Ensure message data is correctly structured for the LLM
        # Sometimes in multi-channel reports, messages_data has different structure than in single-channel reports
        # Make sure the messages list is properly filtered and contains meaningful data

        # Format message content for the LLM - handle potential large message counts
        # IMPORTANT: Make a deep copy to avoid modifying the original data
        import copy

        messages_for_formatting = copy.deepcopy(messages_list)

        # Fix issue #238: Improve message filtering to ensure valid messages are kept
        if messages_for_formatting:
            # Filter for meaningful messages, but be more lenient about what constitutes a valid message
            meaningful_messages = []
            system_messages = []
            empty_messages = []
            join_leave_messages = []

            for msg in messages_for_formatting:
                text = msg.get("text", "").strip()
                user_id = msg.get("user_id")

                # Log some sample messages to understand what we're filtering
                if len(meaningful_messages) < 3 and text and user_id:
                    logger.info(f"Sample valid message - User: {user_id}, Text: '{text[:100]}'")

                # Check for join/leave messages
                is_join_leave = any(
                    marker in text
                    for marker in [
                        "has joined the channel",
                        "has left the channel",
                        "さんがチャンネルに参加しました",
                    ]
                )

                if is_join_leave:
                    join_leave_messages.append(msg)
                elif not text:
                    empty_messages.append(msg)
                elif not user_id:
                    system_messages.append(msg)
                else:
                    # This is a valid message with both user_id and text
                    meaningful_messages.append(msg)

            # Log filtering results
            logger.info(
                f"Message filtering results: {len(meaningful_messages)} meaningful, "
                f"{len(system_messages)} system, {len(empty_messages)} empty, "
                f"{len(join_leave_messages)} join/leave"
            )

            # If we have meaningful messages after filtering, use those
            if meaningful_messages:
                logger.info(f"Using {len(meaningful_messages)} meaningful messages for analysis")
                messages_for_formatting = meaningful_messages
            else:
                # CRITICAL FIX FOR ISSUE #238: If NO meaningful messages found, try to be more lenient
                logger.warning("No meaningful messages found with strict filtering! Trying more lenient approach...")

                # If no meaningful messages with both user_id and text, try including messages with just text
                lenient_messages = [
                    msg
                    for msg in messages_for_formatting
                    if msg.get("text", "").strip()
                    and not any(
                        marker in msg.get("text", "")
                        for marker in [
                            "has joined the channel",
                            "has left the channel",
                            "さんがチャンネルに参加しました",
                        ]
                    )
                ]

                if lenient_messages:
                    logger.info(f"Using {len(lenient_messages)} messages with lenient filtering")
                    messages_for_formatting = lenient_messages
                else:
                    # Last resort - just keep the original messages but log a warning
                    logger.error("CRITICAL: No valid messages found even with lenient filtering!")
                    # Keep original messages_for_formatting, but log this issue

        message_content = self._format_messages(messages_for_formatting)

        # Check if the formatted content is meaningful
        if not message_content.strip():
            logger.error("Formatted message content is empty - LLM will report 'no actual channel messages'")
        elif len(message_content) < 100:
            logger.warning(
                f"Formatted message content is very short ({len(message_content)} chars) - may lead to poor analysis"
            )

        # Build the system prompt with JSON instructions if needed
        system_prompt = """You are an expert analyst of communication patterns in team chat platforms.
You're tasked with analyzing Slack conversation data to help team leaders understand communication dynamics.
Provide insightful, specific, and actionable observations based on actual message content.

IMPORTANT: This Slack channel may contain messages in Japanese or other non-English languages.
Please analyze these messages as best you can. Messages with Japanese text are marked with
"[Note: This message contains Japanese text]". Do not say there are "no actual channel messages"
just because many messages are in Japanese.

CRITICAL: When referring to Slack users in your analysis, always keep the original user mention format
(such as "<@U12345>") intact. Do not replace these mentions with plain text like "Unknown User" or attempt
to resolve them. The frontend application will handle proper user display.

CRITICAL: In your JSON response, you MUST include substantial, relevant content for ALL four required fields:
- channel_summary: Provide a detailed overview of channel activity, purpose, and general atmosphere
- topic_analysis: Identify and analyze the main topics discussed in the channel with specific examples
- contributor_insights: Analyze key contributors, their participation patterns, and interaction styles
- key_highlights: Identify notable moments, decisions, or interactions worth highlighting

Do not leave any of these fields empty, too short, or with placeholder text. Each field should contain substantive insights based on the actual message content provided."""

        if use_json_mode:
            system_prompt += """
Your response must be a valid JSON object with these keys:
- channel_summary: A comprehensive overview of the channel's purpose and activity
- topic_analysis: Identification of main discussion topics with examples
- contributor_insights: Analysis of key contributors and their patterns (preserve user mentions like <@U12345>)
- key_highlights: Notable discussions or interactions worth attention
"""

        # Fix for issue #238: Ensure we provide clear indicators when messages have been filtered
        # Build the user prompt with the template
        filtered_message_count = len(messages_for_formatting)

        # Add a warning if there are significantly fewer messages after filtering
        message_content_prefix = ""
        if filtered_message_count < message_count * 0.8 and message_count > 0:
            message_content_prefix = f"""
IMPORTANT: This analysis includes {filtered_message_count} meaningful messages out of {message_count} total messages.
The remaining messages were system notifications or empty messages that were filtered out.
"""

        # Ensure Japanese messages are properly handled
        if any(all(ord(c) > 127 for c in msg.get("text", "").strip()) for msg in messages_for_formatting[:20]):
            message_content_prefix += """
IMPORTANT: Some messages in this channel are in Japanese. Please analyze them as best you can.
Do not respond that there are "no actual channel messages" just because you see Japanese text.
"""

        # Combine the prefix with the message content
        final_message_content = message_content_prefix + message_content

        user_prompt = CHANNEL_ANALYSIS_PROMPT.format(
            channel_name=channel_name,
            start_date=start_date_str,
            end_date=end_date_str,
            message_count=filtered_message_count,  # Use the filtered count
            participant_count=participant_count,
            thread_count=thread_count,
            reaction_count=reaction_count,
            message_content=final_message_content,
        )

        # Add specific instructions for JSON response if needed
        if use_json_mode:
            user_prompt += """
Format your response as a valid JSON object with these exact keys:
{
  "channel_summary": "...",
  "topic_analysis": "...",
  "contributor_insights": "...",
  "key_highlights": "..."
}

IMPORTANT: You MUST include content for ALL four keys in your response JSON:
- "channel_summary": Overall summary of channel activity and purpose
- "topic_analysis": Analysis of discussion topics in the channel
- "contributor_insights": Analysis of user participation and contributions
- "key_highlights": Notable events or discussions worth highlighting

DO NOT leave any of these fields empty or with placeholder text. Provide substantive content for each field based on the messages provided.

FINAL REMINDER: Don't attempt to resolve or replace Slack user mentions like <@U12345>.
Keep them intact exactly as they appear in the original messages.
"""

        # Build the API request
        request = OpenRouterRequest(
            model=model or self.default_model,
            messages=[
                OpenRouterMessage(role="system", content=system_prompt),
                OpenRouterMessage(role="user", content=user_prompt),
            ],
            max_tokens=self.default_max_tokens,
            temperature=self.default_temperature,
        )

        # Add response_format for JSON mode if the model supports it and JSON mode is requested
        actual_model = model or self.default_model
        model_supports_json = self._model_supports_json_mode(actual_model)

        if use_json_mode and model_supports_json:
            request.response_format = {"type": "json_object"}
            logger.info(f"Using JSON mode for model {actual_model}")
        elif use_json_mode and not model_supports_json:
            logger.warning(
                f"JSON mode requested but model {actual_model} does not support it. Using text mode instead."
            )

        # Call the API
        try:
            # Debug logging for issue #238 - Log the exact request payload
            import json
            from datetime import datetime as dt

            request_payload = request.model_dump()

            # Log the request to a file in /tmp for debugging
            timestamp = dt.now().strftime("%Y%m%d_%H%M%S")
            payload_log_path = f"/tmp/openrouter_request_{timestamp}.json"
            with open(payload_log_path, "w") as f:
                json.dump(request_payload, f, indent=2)

            # Log the key information to the console
            logger.info(f"OpenRouter API request for channel {channel_name}, saved to {payload_log_path}")
            logger.info(f"Request model: {request_payload['model']}")
            logger.info(f"Request has {len(request_payload['messages'])} messages")

            # Log the message lengths to understand token usage
            for i, msg in enumerate(request_payload["messages"]):
                role = msg["role"]
                content_length = len(msg["content"])
                logger.info(f"Message {i} ({role}): {content_length} chars")
                # Log a preview of each message
                if role == "system":
                    logger.info(f"System prompt preview: {msg['content'][:150]}...")
                elif role == "user":
                    # Count actual user messages in the content
                    message_lines = msg["content"].split("\n")
                    user_message_count = sum(1 for line in message_lines if "]" in line and ":" in line)
                    logger.info(f"User prompt has {user_message_count} messages. Preview: {msg['content'][:150]}...")

                    # CRITICAL DEBUG for Issue #238: Log full content to understand what's happening
                    debug_log_path = f"/tmp/openrouter_user_content_{timestamp}.txt"
                    with open(debug_log_path, "w") as f:
                        f.write(msg["content"])
                    logger.info(
                        f"User content saved to {debug_log_path} for debugging \n --------------------------------------"
                    )

                    # Log the first 20 lines for easier inspection
                    logger.info("First 20 lines of user content:")
                    for line_num, line in enumerate(message_lines[:20]):
                        if line.strip():
                            logger.info(f"Line {line_num + 1}: {line[:100]}")

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "HTTP-Referer": f"https://{self.app_site}",
                        "X-Title": self.app_name,
                    },
                    json=request_payload,
                    timeout=60.0,  # Longer timeout for LLM processing
                )

                response.raise_for_status()
                result = response.json()

                # Log the API response for debugging
                response_log_path = f"/tmp/openrouter_response_{timestamp}.json"
                with open(response_log_path, "w") as f:
                    json.dump(result, f, indent=2)
                logger.info(f"OpenRouter API response saved to {response_log_path}")

                # Process the response
                llm_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Log response preview
                logger.info(f"Response content preview: {llm_response[:200]}...")

                # Check for "no actual channel messages" pattern explicitly
                if "no actual channel messages" in llm_response.lower():
                    logger.error("CRITICAL ISSUE #238: LLM responded with 'no actual channel messages'")
                    logger.error("This indicates the message formatting or filtering is removing all valid messages")

                # Try to parse JSON response directly first if we're using JSON mode
                sections = {}
                if use_json_mode:
                    try:
                        import json

                        # Log more detailed raw response for debugging
                        logger.info(f"Raw LLM response (first 300 chars): {llm_response[:300]}...")

                        # For debugging, save the entire response to a log file
                        import os
                        from datetime import datetime as dt_

                        log_dir = "/tmp/openrouter_logs"
                        os.makedirs(log_dir, exist_ok=True)
                        timestamp = dt_.now().strftime("%Y%m%d_%H%M%S")
                        full_log_path = f"{log_dir}/llm_response_{timestamp}.json"
                        with open(full_log_path, "w") as f:
                            f.write(llm_response)
                        logger.info(f"Full LLM response saved to {full_log_path}")

                        # Check if response mentions "no actual channel messages"
                        if "no actual channel messages" in llm_response.lower():
                            logger.error(
                                "LLM response mentions 'no actual channel messages' - message format may be unrecognized"
                            )

                        # Handle potential JSON formatting in text response
                        json_content = llm_response.strip()
                        logger.info(
                            f"Initial JSON processing - Content type: {type(json_content)}, Length: {len(json_content)}"
                        )

                        # Check for markdown code blocks
                        if json_content.startswith("```json"):
                            logger.info("Detected markdown JSON code block")
                            json_content = json_content.split("```json", 1)[1]
                        elif json_content.startswith("```"):
                            logger.info("Detected generic markdown code block")
                            json_content = json_content.split("```", 1)[1]

                        if json_content.endswith("```"):
                            logger.info("Removing trailing markdown code block markers")
                            json_content = json_content.rsplit("```", 1)[0]

                        # Log intermediate state
                        logger.info(f"After markdown removal - Content length: {len(json_content)}")
                        logger.info(f"Content starts with: {json_content[:50]}...")
                        logger.info(f"Content ends with: ...{json_content[-50:]}")

                        # Sanitize the JSON content by removing any control characters
                        # Control characters can cause JSON parsing errors
                        import re

                        original_length = len(json_content)
                        json_content = re.sub(r"[\x00-\x1F\x7F]", "", json_content.strip())
                        sanitized_length = len(json_content)

                        if original_length != sanitized_length:
                            logger.info(f"Removed {original_length - sanitized_length} control characters from JSON")

                        # Make sure the content starts with a curly brace for JSON object
                        if not json_content.startswith("{"):
                            logger.warning(f"JSON content doesn't start with '{{', current start: {json_content[:10]}")
                            # Try to find the first opening curly brace
                            first_brace_pos = json_content.find("{")
                            if first_brace_pos >= 0:
                                logger.info(f"Found opening brace at position {first_brace_pos}, trimming content")
                                json_content = json_content[first_brace_pos:]

                        # Make sure the content ends with a curly brace for JSON object
                        if not json_content.endswith("}"):
                            logger.warning(f"JSON content doesn't end with '}}', current end: {json_content[-10:]}")
                            # Try to find the last closing curly brace
                            last_brace_pos = json_content.rfind("}")
                            if last_brace_pos >= 0:
                                logger.info(f"Found closing brace at position {last_brace_pos}, trimming content")
                                json_content = json_content[: last_brace_pos + 1]

                        # Write the sanitized content to a file for debugging
                        sanitized_log_path = f"{log_dir}/sanitized_json_{timestamp}.json"
                        with open(sanitized_log_path, "w") as f:
                            f.write(json_content)
                        logger.info(f"Sanitized JSON content saved to {sanitized_log_path}")

                        # Multiple parsing attempts with progressively more aggressive fixing
                        try:
                            # First attempt: basic parsing
                            parsed_json = json.loads(json_content)
                            logger.info("JSON parsing succeeded on first attempt")
                        except json.JSONDecodeError as json_err:
                            logger.warning(f"First JSON parsing attempt failed at char {json_err.pos}: {str(json_err)}")
                            # Show the problematic part of the JSON
                            error_context_start = max(0, json_err.pos - 20)
                            error_context_end = min(len(json_content), json_err.pos + 20)
                            error_context = json_content[error_context_start:error_context_end]
                            logger.warning(f"Error context: ...{error_context}...")

                            try:
                                # Second attempt: fix unescaped quotes in values
                                logger.info("Attempting to fix unescaped quotes")
                                fixed_content = re.sub(r'(?<!\\)"(?=(.*?".*?"))', r"\"", json_content)
                                parsed_json = json.loads(fixed_content)
                                logger.info("JSON parsing succeeded after fixing unescaped quotes")
                            except json.JSONDecodeError as json_err2:
                                logger.warning(
                                    f"Second JSON parsing attempt failed at char {json_err2.pos}: {str(json_err2)}"
                                )

                                try:
                                    # Third attempt: try using a more lenient JSON parser or validator library
                                    from json5 import loads as json5_loads

                                    logger.info("Trying JSON5 parser for more lenient parsing")
                                    parsed_json = json5_loads(json_content)
                                    logger.info("JSON5 parsing succeeded")
                                except ImportError:
                                    logger.warning("JSON5 or jsonschema library not available, skipping third attempt")
                                    raise json_err2
                                except Exception as e:
                                    logger.warning(f"Third JSON parsing attempt failed: {str(e)}")
                                    raise json_err2

                        # Log successful parsing
                        logger.info(f"Successfully parsed JSON response with keys: {', '.join(parsed_json.keys())}")

                        # Map expected fields from JSON response and ensure none are missing
                        required_keys = [
                            "channel_summary",
                            "topic_analysis",
                            "contributor_insights",
                            "key_highlights",
                        ]
                        for key in required_keys:
                            if key in parsed_json and parsed_json[key]:
                                sections[key] = parsed_json[key]
                            else:
                                logger.warning(
                                    f"JSON response missing or has empty '{key}' field - using raw LLM response"
                                )
                                # Don't add generic fallback content - instead try to use the raw LLM output
                                # We'll get the content directly from llm_response later if needed
                    except (json.JSONDecodeError, ValueError, KeyError) as e:
                        logger.warning(f"Failed to parse JSON response: {str(e)}. Falling back to text extraction.")

                # Fall back to extracting sections from text if JSON parsing failed or not used
                if not any(sections.values()):
                    logger.info("No valid JSON parsed - attempting to extract sections from text")
                    sections = self._extract_sections(llm_response)

                # Ensure all required sections are present - if not, use the raw llm_response
                for key in [
                    "channel_summary",
                    "topic_analysis",
                    "contributor_insights",
                    "key_highlights",
                ]:
                    if key not in sections or not sections[key]:
                        logger.info(f"Using raw LLM response for missing section: {key}")
                        # Get directly from the raw text response
                        sections[key] = llm_response

                # Add the model used to the response
                sections["model_used"] = result.get("model", model or self.default_model)

                return sections

        except httpx.HTTPStatusError as e:
            error_detail = f"HTTP error {e.response.status_code}"
            try:
                error_json = e.response.json()
                error_detail = f"{error_detail}: {error_json.get('error', {}).get('message', 'Unknown error')}"
            except Exception:
                pass

            logger.error(f"OpenRouter API error: {error_detail}")
            raise ValueError(f"Error calling OpenRouter API: {error_detail}")
        except httpx.RequestError as e:
            logger.error(f"OpenRouter request error: {str(e)}")
            raise ValueError(f"Error connecting to OpenRouter API: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in OpenRouter service: {str(e)}")
            raise ValueError(f"Unexpected error in analysis: {str(e)}")

    def _format_messages(self, messages: List[Dict[str, Any]]) -> str:
        """Format messages for inclusion in the prompt, applying sampling for large datasets."""
        # Add debug log for issue #238
        logger.info(f"Formatting {len(messages)} messages for LLM input")

        # Check content characteristics for debugging
        if messages:
            join_messages = sum(1 for m in messages if "さんがチャンネルに参加しました" in m.get("text", ""))
            empty_messages = sum(1 for m in messages if not m.get("text", "").strip())
            system_messages = sum(1 for m in messages if not m.get("user_id"))

            logger.info(
                f"Message content stats: "
                f"{join_messages} join messages, "
                f"{empty_messages} empty messages, "
                f"{system_messages} system messages, "
                f"{len(messages) - join_messages - empty_messages - system_messages} regular messages"
            )

            # Log a few sample messages for inspection
            logger.info("Sample messages being formatted for LLM:")
            for i, msg in enumerate(messages[:5]):
                logger.info(
                    f"  {i + 1}. User: {msg.get('user', 'Unknown')} | "
                    f"ID: {msg.get('user_id', 'None')} | "
                    f"Text: {msg.get('text', '')[:100]}"
                )

        # Helper to format user mention properly
        def format_user_mention(msg):
            # Preserve original user ID if we have it, fallback to user_name
            user_id = msg.get("user_id")
            timestamp = msg.get("timestamp", "")
            text = msg.get("text", "")

            if user_id:
                # Use Slack user mention format which frontend can resolve
                return f"[{timestamp}] <@{user_id}>: {text}"
            else:
                # Fallback to user_name but avoid "Unknown User" label
                user = msg.get("user_name", "Participant") or msg.get("user", "Participant")
                return f"[{timestamp}] {user}: {text}"

        # Determine if we need to sample
        if len(messages) > 200:
            # With larger datasets, we take samples from beginning, middle and end
            sample_size = min(50, len(messages) // 4)  # Adjust based on your token budget

            # Get samples from beginning, middle, and end
            start_sample = messages[:sample_size]
            middle_idx = len(messages) // 2
            middle_sample = messages[middle_idx - sample_size // 2 : middle_idx + sample_size // 2]
            end_sample = messages[-sample_size:]

            # Combine samples
            sampled_messages = start_sample + middle_sample + end_sample

            # Format with special handling for Japanese text (issue #238)
            formatted_messages = []
            for msg in sampled_messages:
                formatted = format_user_mention(msg)
                # For Japanese text, add a note to help LLM understand
                text = msg.get("text", "")
                if text and all(ord(c) > 127 for c in text.strip()):
                    formatted += " [Note: This message contains Japanese text]"
                formatted_messages.append(formatted)

            return "\n".join(
                [
                    "--- SAMPLE OF MESSAGES (due to high message volume) ---",
                    "Beginning of time period:",
                    "\n".join(formatted_messages[:sample_size]),
                    "\nMiddle of time period:",
                    "\n".join(formatted_messages[sample_size : 2 * sample_size]),
                    "\nEnd of time period:",
                    "\n".join(formatted_messages[2 * sample_size :]),
                    "--- END OF SAMPLE ---",
                ]
            )
        else:
            # For smaller datasets, include everything
            # Format with special handling for Japanese text (issue #238)
            formatted_messages = []
            for msg in messages:
                formatted = format_user_mention(msg)
                # For Japanese text, add a note to help LLM understand
                text = msg.get("text", "")
                if text and all(ord(c) > 127 for c in text.strip()):
                    formatted += " [Note: This message contains Japanese text]"
                formatted_messages.append(formatted)

            return "\n".join(formatted_messages)

    def _extract_sections(self, llm_response: str) -> Dict[str, str]:
        """Extract the different sections from the LLM response."""
        sections = {
            "channel_summary": "",
            "topic_analysis": "",
            "contributor_insights": "",
            "key_highlights": "",
        }

        # Find sections in the response
        section_titles = {
            "channel_summary": [
                "CHANNEL SUMMARY",
                "Channel Summary",
                "CHANNEL_SUMMARY",
            ],
            "topic_analysis": ["TOPIC ANALYSIS", "Topic Analysis", "TOPIC_ANALYSIS"],
            "contributor_insights": [
                "CONTRIBUTOR INSIGHTS",
                "Contributor Insights",
                "CONTRIBUTOR_INSIGHTS",
            ],
            "key_highlights": ["KEY HIGHLIGHTS", "Key Highlights", "KEY_HIGHLIGHTS"],
        }

        # Add more patterns to improve recognition
        title_patterns = []
        for key, variants in section_titles.items():
            for variant in variants:
                # Add patterns with different separators
                title_patterns.append((key, f"{variant}:"))
                title_patterns.append((key, f"{variant}:".upper()))
                title_patterns.append((key, f"{variant}\n"))
                title_patterns.append((key, f"**{variant}**"))
                title_patterns.append((key, f"## {variant}"))
                title_patterns.append((key, f"{variant}"))

        # Sort patterns by length (longest first) to avoid partial matches
        title_patterns.sort(key=lambda x: len(x[1]), reverse=True)

        for section_key, title_pattern in title_patterns:
            # Try to find the pattern
            idx = llm_response.find(title_pattern)
            if idx >= 0:
                start_idx = idx + len(title_pattern)

                # Find the next section (if any)
                next_section_idx = float("inf")
                for other_key, other_pattern in title_patterns:
                    if other_key != section_key:  # Skip the current section
                        other_idx = llm_response.find(other_pattern, start_idx)
                        if other_idx >= 0 and other_idx < next_section_idx:
                            next_section_idx = other_idx

                if next_section_idx < float("inf"):
                    section_content = llm_response[start_idx:next_section_idx].strip()
                else:
                    section_content = llm_response[start_idx:].strip()

                # Only update if we found content and the section isn't already populated
                if section_content and not sections[section_key]:
                    sections[section_key] = section_content

        # Check for missing sections and provide fallback content
        for key in sections:
            if not sections[key]:
                logger.warning(f"Failed to extract '{key}' section from text response - adding fallback content")
                if key == "channel_summary":
                    sections[key] = (
                        "This channel contains team discussions and collaboration. The messages show interactions between multiple participants on work-related topics."
                    )
                elif key == "topic_analysis":
                    sections[key] = (
                        "The messages in this channel cover various work-related topics. The discussion themes include project updates, technical discussions, and team coordination."
                    )
                elif key == "contributor_insights":
                    sections[key] = (
                        "Several users contributed to this channel during the analysis period. Some users were more active in starting discussions, while others participated primarily by responding to existing threads."
                    )
                elif key == "key_highlights":
                    sections[key] = (
                        "The channel had active discussion periods with noticeable team collaboration. Key moments included information sharing and problem-solving discussions."
                    )

        # Fallback: If we couldn't extract any sections, use the whole response for all sections
        if all(not v for v in sections.values()):
            logger.warning("Couldn't extract any sections from text response - using full response for all sections")
            # Use the full LLM response for all sections rather than generic text
            sections["channel_summary"] = llm_response
            sections["topic_analysis"] = llm_response
            sections["contributor_insights"] = llm_response
            sections["key_highlights"] = llm_response

        return sections
