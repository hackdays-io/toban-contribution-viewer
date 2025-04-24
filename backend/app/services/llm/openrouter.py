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
        "openai/gpt-4",        # GPT-4 models
        "openai/gpt-3.5-turbo",
        "mistralai/mistral-large",
        "google/gemini-pro",
    ]

    def __init__(self):
        """Initialize the OpenRouter service with configuration from settings."""
        self.api_key = (
            settings.OPENROUTER_API_KEY.get_secret_value()
            if settings.OPENROUTER_API_KEY
            else None
        )
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set in environment variables")

        # Default configuration
        self.default_model = settings.OPENROUTER_DEFAULT_MODEL
        self.default_max_tokens = settings.OPENROUTER_MAX_TOKENS
        self.default_temperature = settings.OPENROUTER_TEMPERATURE

        # App info for OpenRouter headers
        self.app_name = "Toban Contribution Viewer"
        self.app_site = os.environ.get(
            "SITE_DOMAIN", "toban-contribution-viewer.example.com"
        )

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
        # Convert datetime to ISO string if needed
        start_date_str = (
            start_date.isoformat() if isinstance(start_date, datetime) else start_date
        )
        end_date_str = (
            end_date.isoformat() if isinstance(end_date, datetime) else end_date
        )

        # Prepare the context for the LLM
        message_count = messages_data.get("message_count", 0)
        participant_count = messages_data.get("participant_count", 0)
        thread_count = messages_data.get("thread_count", 0)
        reaction_count = messages_data.get("reaction_count", 0)

        # Format message content for the LLM - handle potential large message counts
        message_content = self._format_messages(messages_data.get("messages", []))

        # Build the system prompt with JSON instructions if needed
        system_prompt = """You are an expert analyst of communication patterns in team chat platforms.
You're tasked with analyzing Slack conversation data to help team leaders understand communication dynamics.
Provide insightful, specific, and actionable observations based on actual message content.

CRITICAL: When referring to Slack users in your analysis, always keep the original user mention format
(such as "<@U12345>") intact. Do not replace these mentions with plain text like "Unknown User" or attempt
to resolve them. The frontend application will handle proper user display."""

        if use_json_mode:
            system_prompt += """
Your response must be a valid JSON object with these keys:
- channel_summary: A comprehensive overview of the channel's purpose and activity
- topic_analysis: Identification of main discussion topics with examples
- contributor_insights: Analysis of key contributors and their patterns (preserve user mentions like <@U12345>)
- key_highlights: Notable discussions or interactions worth attention
"""

        # Build the user prompt with the template
        user_prompt = CHANNEL_ANALYSIS_PROMPT.format(
            channel_name=channel_name,
            start_date=start_date_str,
            end_date=end_date_str,
            message_count=message_count,
            participant_count=participant_count,
            thread_count=thread_count,
            reaction_count=reaction_count,
            message_content=message_content,
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
            logger.warning(f"JSON mode requested but model {actual_model} does not support it. Using text mode instead.")

        # Call the API
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "HTTP-Referer": f"https://{self.app_site}",
                        "X-Title": self.app_name,
                    },
                    json=request.model_dump(),
                    timeout=60.0,  # Longer timeout for LLM processing
                )

                response.raise_for_status()
                result = response.json()

                # Process the response
                llm_response = (
                    result.get("choices", [{}])[0].get("message", {}).get("content", "")
                )

                # Try to parse JSON response directly first if we're using JSON mode
                sections = {}
                if use_json_mode:
                    try:
                        import json

                        # Handle potential JSON formatting in text response
                        json_content = llm_response.strip()
                        if json_content.startswith("```json"):
                            json_content = json_content.split("```json", 1)[1]
                        if json_content.endswith("```"):
                            json_content = json_content.rsplit("```", 1)[0]

                        parsed_json = json.loads(json_content.strip())

                        # Map expected fields from JSON response
                        for key in ["channel_summary", "topic_analysis", "contributor_insights", "key_highlights"]:
                            if key in parsed_json:
                                sections[key] = parsed_json[key]
                    except (json.JSONDecodeError, ValueError, KeyError) as e:
                        logger.warning(f"Failed to parse JSON response: {str(e)}. Falling back to text extraction.")

                # Fall back to extracting sections from text if JSON parsing failed or not used
                if not any(sections.values()):
                    sections = self._extract_sections(llm_response)

                # Add the model used to the response
                sections["model_used"] = result.get(
                    "model", model or self.default_model
                )

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
                user = msg.get("user_name", "Participant")
                return f"[{timestamp}] {user}: {text}"

        # Determine if we need to sample
        if len(messages) > 200:
            # With larger datasets, we take samples from beginning, middle and end
            sample_size = min(
                50, len(messages) // 4
            )  # Adjust based on your token budget

            # Get samples from beginning, middle, and end
            start_sample = messages[:sample_size]
            middle_idx = len(messages) // 2
            middle_sample = messages[
                middle_idx - sample_size // 2 : middle_idx + sample_size // 2
            ]
            end_sample = messages[-sample_size:]

            # Combine samples
            sampled_messages = start_sample + middle_sample + end_sample

            formatted_messages = [format_user_mention(msg) for msg in sampled_messages]

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
            formatted_messages = [format_user_mention(msg) for msg in messages]
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
            "channel_summary": ["CHANNEL SUMMARY", "Channel Summary"],
            "topic_analysis": ["TOPIC ANALYSIS", "Topic Analysis"],
            "contributor_insights": ["CONTRIBUTOR INSIGHTS", "Contributor Insights"],
            "key_highlights": ["KEY HIGHLIGHTS", "Key Highlights"],
        }

        for section_key, title_variants in section_titles.items():
            # Try to find any of the title variants
            start_idx = -1
            for title in title_variants:
                idx = llm_response.find(f"{title}:")
                if idx >= 0:
                    start_idx = idx + len(title) + 1
                    break

            if start_idx >= 0:
                # Find the next section
                next_section_idx = float("inf")
                for other_titles in section_titles.values():
                    for other_title in other_titles:
                        if f"{other_title}:" in llm_response:
                            idx = llm_response.find(f"{other_title}:", start_idx)
                            if idx >= 0 and idx < next_section_idx:
                                next_section_idx = idx

                if next_section_idx < float("inf"):
                    sections[section_key] = llm_response[
                        start_idx:next_section_idx
                    ].strip()
                else:
                    sections[section_key] = llm_response[start_idx:].strip()

        # Fallback: If we couldn't extract sections, just include the whole response
        if all(not v for v in sections.values()):
            sections["channel_summary"] = llm_response

        return sections
