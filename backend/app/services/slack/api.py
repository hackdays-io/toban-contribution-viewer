"""
Slack API client for making requests to the Slack API.
"""

import logging
from typing import Any, Dict, Optional

import aiohttp

# Configure logging
logger = logging.getLogger(__name__)


class SlackApiError(Exception):
    """Base exception for Slack API errors."""

    def __init__(
        self, message: str, error_code: str, response_data: Dict[str, Any]
    ) -> None:
        self.message = message
        self.error_code = error_code
        self.response_data = response_data
        super().__init__(message)


class SlackApiRateLimitError(SlackApiError):
    """Exception for Slack API rate limiting errors."""

    def __init__(
        self,
        message: str,
        error_code: str,
        response_data: Dict[str, Any],
        retry_after: int = 60,
    ) -> None:
        self.retry_after = retry_after
        super().__init__(message, error_code, response_data)


class SlackApiClient:
    """
    Client for making requests to the Slack API.
    """

    def __init__(self, access_token: str) -> None:
        """
        Initialize the Slack API client.

        Args:
            access_token: Slack access token
        """
        self.access_token = access_token
        self.base_url = "https://slack.com/api"

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Make a request to the Slack API.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API endpoint path
            params: Query parameters
            data: Form data
            json_data: JSON data
            headers: HTTP headers

        Returns:
            Parsed JSON response

        Raises:
            SlackApiError: If the API returns an error
            SlackApiRateLimitError: If the API rate limit is exceeded
        """
        # Prepare headers with authorization
        request_headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8",
        }

        # Add custom headers if provided
        if headers:
            request_headers.update(headers)

        # Build full URL
        url = f"{self.base_url}/{path}"

        logger.debug(f"Making {method} request to {url}")

        try:
            # Make the request
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=url,
                    params=params,
                    data=data,
                    json=json_data,
                    headers=request_headers,
                    timeout=10,
                ) as response:
                    # Check for rate limiting
                    if response.status == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        logger.warning(
                            f"Rate limited by Slack API. Retry after {retry_after} seconds."
                        )

                        # Try to parse response data for error details
                        try:
                            response_data = await response.json()
                        except Exception:
                            response_data = {"error": "rate_limited"}

                        raise SlackApiRateLimitError(
                            message=f"Rate limited by Slack API. Retry after {retry_after} seconds.",
                            error_code="rate_limited",
                            response_data=response_data,
                            retry_after=retry_after,
                        )

                    # Handle other HTTP errors
                    if response.status >= 400:
                        try:
                            response_data = await response.json()
                        except Exception:
                            response_data = {"error": f"HTTP error {response.status}"}

                        error_code = response_data.get(
                            "error", f"http_{response.status}"
                        )
                        error_message = response_data.get(
                            "error_description", f"HTTP error {response.status}"
                        )

                        raise SlackApiError(
                            message=f"Slack API error: {error_message}",
                            error_code=error_code,
                            response_data=response_data,
                        )

                    # Parse JSON response
                    response_data = await response.json()

                    # Check for API errors in response data
                    if not response_data.get("ok", False):
                        error_code = response_data.get("error", "unknown_error")
                        error_message = response_data.get(
                            "error_description", f"Slack API error: {error_code}"
                        )

                        # Handle authentication errors specially
                        if error_code in [
                            "invalid_auth",
                            "token_expired",
                            "not_authed",
                        ]:
                            logger.error(f"Authentication error: {error_code}")
                            raise SlackApiError(
                                message=f"Slack API authentication error: {error_message}",
                                error_code=error_code,
                                response_data=response_data,
                            )

                        # Handle other API errors
                        logger.error(f"Slack API error: {error_code} - {error_message}")
                        raise SlackApiError(
                            message=f"Slack API error: {error_message}",
                            error_code=error_code,
                            response_data=response_data,
                        )

                    return response_data

        except aiohttp.ClientError as e:
            logger.error(f"HTTP client error: {str(e)}")
            raise SlackApiError(
                message=f"HTTP client error: {str(e)}",
                error_code="http_client_error",
                response_data={},
            )

    async def get_workspace_info(self) -> Dict[str, Any]:
        """
        Get information about the workspace.

        Returns:
            Workspace information
        """
        response = await self._make_request("GET", "team.info")
        return response.get("team", {})

    async def get_user_count(self) -> int:
        """
        Get the number of users in the workspace.

        Returns:
            Number of users
        """
        response = await self._make_request("GET", "users.list", params={"limit": 1})
        return response.get("response_metadata", {}).get("total_count", 0)

    async def verify_token(self) -> bool:
        """
        Verify if the access token is valid.

        Returns:
            True if the token is valid, False otherwise
        """
        try:
            await self._make_request("GET", "auth.test")
            return True
        except SlackApiError:
            return False

    async def get_channels(
        self,
        cursor: Optional[str] = None,
        limit: int = 100,
        types: str = "public_channel,private_channel",
        exclude_archived: bool = False,
    ) -> Dict[str, Any]:
        """
        Get channels in the workspace.

        Args:
            cursor: Pagination cursor
            limit: Number of channels to fetch
            types: Channel types to include (comma-separated)
            exclude_archived: Whether to exclude archived channels

        Returns:
            Channels and pagination info
        """
        params = {
            "types": types,
            "limit": limit,
        }

        if exclude_archived:
            params["exclude_archived"] = "true"

        if cursor:
            params["cursor"] = cursor

        return await self._make_request("GET", "conversations.list", params=params)

    async def get_channel_info(self, channel_id: str) -> Dict[str, Any]:
        """
        Get information about a channel.

        Args:
            channel_id: Slack channel ID

        Returns:
            Channel information
        """
        return await self._make_request(
            "GET", "conversations.info", params={"channel": channel_id}
        )

    async def check_bot_in_channel(self, channel_id: str) -> bool:
        """
        Check if the bot is in the channel.

        Args:
            channel_id: Slack channel ID

        Returns:
            True if the bot is in the channel, False otherwise
        """
        try:
            # Get bot user info
            auth_info = await self._make_request("GET", "auth.test")
            bot_user_id = auth_info.get("bot_id")

            if not bot_user_id:
                return False

            # Check if bot is in channel
            channel_info = await self.get_channel_info(channel_id)
            return channel_info.get("is_member", False)
        except SlackApiError:
            return False

    async def join_channel(self, channel_id: str) -> bool:
        """
        Join a channel.

        Args:
            channel_id: Slack channel ID

        Returns:
            True if joined successfully, False otherwise
        """
        try:
            response = await self._make_request(
                "POST", "conversations.join", json_data={"channel": channel_id}
            )
            return response.get("ok", False)
        except SlackApiError:
            return False

    async def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """
        Get information about a specific user.

        Args:
            user_id: Slack user ID

        Returns:
            User information

        Raises:
            SlackApiError: If the API returns an error
        """
        logger.debug(f"Fetching user info for user_id: {user_id}")
        return await self._make_request("GET", "users.info", params={"user": user_id})

    async def get_thread_replies(
        self,
        channel_id: str,
        thread_ts: str,
        cursor: Optional[str] = None,
        limit: int = 100,
        inclusive: bool = True,
    ) -> Dict[str, Any]:
        """
        Get replies in a thread.

        Args:
            channel_id: Slack channel ID
            thread_ts: Thread parent message timestamp
            cursor: Pagination cursor
            limit: Number of messages to fetch (max 1000)
            inclusive: Include the parent message in the replies

        Returns:
            Thread replies and pagination info

        Raises:
            SlackApiError: If the API returns an error
        """
        logger.debug(
            f"Fetching thread replies for ts: {thread_ts} in channel: {channel_id}"
        )

        params = {
            "channel": channel_id,
            "ts": thread_ts,
            "limit": min(limit, 1000),  # Enforce Slack API limit
            "inclusive": inclusive,
        }

        if cursor:
            params["cursor"] = cursor

        return await self._make_request("GET", "conversations.replies", params=params)
