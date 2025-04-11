"""
Slack API client service for interacting with the Slack API.
"""

import logging
from typing import Any, Dict, Optional

import aiohttp

# Configure logging
logger = logging.getLogger(__name__)


class SlackApiError(Exception):
    """Exception raised for Slack API errors."""

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        response_data: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.response_data = response_data
        super().__init__(self.message)


class SlackApiRateLimitError(SlackApiError):
    """Exception raised for Slack API rate limit errors."""

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, "rate_limited", response_data)
        self.retry_after = retry_after


class SlackApiClient:
    """
    Client for interacting with the Slack API.
    Handles authentication, rate limiting, and error handling.
    """

    def __init__(self, access_token: str):
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
        url_path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Make a request to the Slack API with error handling and rate limiting.

        Args:
            method: HTTP method (GET, POST, etc.)
            url_path: API endpoint path
            params: Query parameters
            data: Form data
            json_data: JSON data
            headers: HTTP headers

        Returns:
            API response as dictionary

        Raises:
            SlackApiError: If the API returns an error
            SlackApiRateLimitError: If rate limited
        """
        full_url = f"{self.base_url}/{url_path}"

        # Prepare headers
        request_headers = {
            "Authorization": f"Bearer {self.access_token}",
        }

        if headers:
            request_headers.update(headers)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=full_url,
                    params=params,
                    data=data,
                    json=json_data,
                    headers=request_headers,
                    timeout=10,  # Set a reasonable timeout
                ) as response:
                    # Check for rate limiting
                    if response.status == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        logger.warning(
                            f"Rate limited by Slack API. Retry after {retry_after} seconds."
                        )
                        raise SlackApiRateLimitError(
                            message="Rate limited by Slack API", retry_after=retry_after
                        )

                    # Get response data
                    response_data = await response.json()

                    # Check for API errors
                    if not response_data.get("ok", False):
                        error_code = response_data.get("error", "unknown_error")
                        error_msg = response_data.get(
                            "error_description", "Unknown API error"
                        )

                        # Specific error handling
                        if (
                            error_code == "invalid_auth"
                            or error_code == "token_expired"
                        ):
                            logger.error(
                                f"Authentication error: {error_code} - {error_msg}"
                            )
                            raise SlackApiError(
                                message=f"Slack authentication error: {error_msg}",
                                error_code=error_code,
                                response_data=response_data,
                            )

                        logger.error(f"Slack API error: {error_code} - {error_msg}")
                        raise SlackApiError(
                            message=f"Slack API error: {error_msg}",
                            error_code=error_code,
                            response_data=response_data,
                        )

                    return response_data

        except aiohttp.ClientError as e:
            logger.error(f"HTTP error during Slack API request: {str(e)}")
            raise SlackApiError(
                message=f"HTTP error during Slack API request: {str(e)}"
            )

    async def get_workspace_info(self) -> Dict[str, Any]:
        """
        Get information about the current workspace.

        Returns:
            Workspace information including name, domain, and icon
        """
        try:
            response = await self._make_request("GET", "team.info")
            return response.get("team", {})
        except SlackApiError as e:
            logger.error(f"Error getting workspace info: {str(e)}")
            raise

    async def get_user_count(self) -> int:
        """
        Get the number of users in the workspace.

        Returns:
            Team size (number of users)
        """
        try:
            response = await self._make_request(
                "GET",
                "users.list",
                params={"limit": 1},  # Just need the count, not actual users
            )
            return response.get("response_metadata", {}).get("total_count", 0)
        except SlackApiError as e:
            logger.error(f"Error getting user count: {str(e)}")
            # Return 0 as a fallback
            return 0

    async def verify_token(self) -> bool:
        """
        Verify that the access token is valid.

        Returns:
            True if the token is valid, False otherwise
        """
        try:
            # Call a simple API endpoint that requires authentication
            await self._make_request("GET", "auth.test")
            return True
        except SlackApiError as e:
            logger.warning(f"Token verification failed: {e.error_code}")
            if e.error_code in ["invalid_auth", "token_expired"]:
                return False
            # For other errors, the token might still be valid
            raise
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {str(e)}")
            # Re-raise the exception to be handled by the caller
            raise

    async def get_channels(
        self,
        cursor: Optional[str] = None,
        limit: int = 100,
        types: Optional[str] = "public_channel,private_channel",
        exclude_archived: Any = True,
    ) -> Dict[str, Any]:
        """
        Get a list of channels from the workspace.

        Note: This method supports cursor-based pagination. The cursor should be
        extracted from the response_metadata.next_cursor field of the previous response.

        Args:
            cursor: Pagination cursor from a previous response
            limit: Maximum number of channels to return (max 1000)
            types: Comma-separated list of channel types to include
                  (public_channel, private_channel, mpim, im)
            exclude_archived: Whether to exclude archived channels

        Returns:
            Dictionary containing channels list and pagination metadata
        """
        try:
            params = {
                "limit": min(limit, 1000),  # Enforce Slack API limit
                "exclude_archived": str(
                    exclude_archived
                ).lower(),  # Convert to string "true" or "false"
            }

            if cursor and cursor.strip():
                params["cursor"] = cursor.strip()
                logger.info(f"Using cursor for pagination: {cursor}")

            if types:
                params["types"] = types

            response = await self._make_request(
                "GET", "conversations.list", params=params
            )

            return response
        except SlackApiError as e:
            logger.error(f"Error getting channels list: {str(e)}")
            raise

    async def get_channel_info(self, channel_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific channel.

        Args:
            channel_id: Slack ID of the channel

        Returns:
            Dictionary containing channel information
        """
        try:
            response = await self._make_request(
                "GET", "conversations.info", params={"channel": channel_id}
            )

            return response.get("channel", {})
        except SlackApiError as e:
            logger.error(f"Error getting channel info for {channel_id}: {str(e)}")
            raise

    async def check_bot_in_channel(self, channel_id: str) -> bool:
        """
        Check if the bot is a member of the specified channel.

        Args:
            channel_id: Slack ID of the channel

        Returns:
            True if the bot is a member of the channel, False otherwise
        """
        try:
            # First get auth info to know the bot's user ID
            auth_info = await self._make_request("GET", "auth.test")
            bot_user_id = auth_info.get("user_id")

            if not bot_user_id:
                logger.error("Could not determine bot user ID")
                return False

            # Check if the bot is in the channel
            try:
                # For public channels, we can check directly
                channel_info = await self.get_channel_info(channel_id)
                # Some channels report bot membership directly
                if "is_member" in channel_info:
                    return channel_info["is_member"]

                # Otherwise check member list
                response = await self._make_request(
                    "GET",
                    "conversations.members",
                    params={"channel": channel_id, "limit": 100},
                )

                # Check first page of members
                if bot_user_id in response.get("members", []):
                    return True

                # If not found and there are more pages, we'd need to paginate
                # through all members, but for efficiency we'll join the channel
                # later if needed instead of checking all members

                return False

            except SlackApiError as e:
                # If we get a channel_not_found error, the bot is definitely not in the channel
                if e.error_code == "channel_not_found":
                    return False
                # For some private channels, we might get an access error
                if e.error_code in [
                    "not_in_channel",
                    "channel_not_found",
                    "missing_scope",
                ]:
                    return False
                # For other errors, re-raise
                raise

        except SlackApiError as e:
            logger.error(
                f"Error checking bot membership in channel {channel_id}: {str(e)}"
            )
            if e.error_code in ["channel_not_found", "not_in_channel"]:
                return False
            raise
        except Exception as e:
            logger.error(f"Unexpected error checking bot membership: {str(e)}")
            raise
