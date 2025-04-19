"""
Slack API client for making requests to the Slack API.
"""

import logging
from typing import Any, Dict, List, Optional

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

        # Filter out None values and convert booleans to strings for URL encoding
        if params:
            # Filter out None values and convert booleans to strings
            params = {
                k: ("true" if v is True else "false" if v is False else v) 
                for k, v in params.items() 
                if v is not None
            }
            
        # Build full URL
        url = f"{self.base_url}/{path}"

        logger.info(f"Making {method} request to {url}")
        logger.info(f"Request params: {params}")

        # Redact token information from logs but show format
        headers_log = {
            k: (v[:10] + "..." + v[-4:] if k == "Authorization" else v)
            for k, v in request_headers.items()
        }
        logger.info(f"Headers: {headers_log}")

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
                    timeout=30,  # Increased timeout for reliability
                ) as response:
                    status = response.status
                    logger.info(f"Slack API response status: {status}")

                    # Log response headers
                    logger.info(f"Response headers: {dict(response.headers)}")
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

                    # Add detailed logging for debugging
                    logger.info(f"Response data keys: {list(response_data.keys())}")

                    # Detailed logging for debugging thread replies
                    ok = response_data.get("ok", False)
                    has_messages = "messages" in response_data
                    msg_count = len(response_data.get("messages", []))
                    error = response_data.get("error", "none")
                    warning = response_data.get("warning", "none")
                    has_metadata = "response_metadata" in response_data

                    logger.info(
                        f"Response summary: ok={ok}, has_messages={has_messages}, msg_count={msg_count}, error='{error}', warning='{warning}', has_metadata={has_metadata}"
                    )

                    # If we have messages, log some details about them
                    if has_messages and msg_count > 0:
                        messages = response_data.get("messages", [])
                        logger.info(
                            f"First message type: {messages[0].get('type', 'unknown')}"
                        )
                        logger.info(
                            f"Message timestamps: {[msg.get('ts') for msg in messages[:3]]}"
                        )

                    # Check for API errors in response data
                    if not response_data.get("ok", False):
                        error_code = response_data.get("error", "unknown_error")
                        error_message = response_data.get(
                            "error_description", f"Slack API error: {error_code}"
                        )
                        logger.error(f"Slack API error: {error_code} - {error_message}")
                        logger.error(f"Full error response: {response_data}")

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

    async def exchange_code(
        self, code: str, redirect_uri: str, client_id: str, client_secret: str
    ) -> Dict[str, Any]:
        """
        Exchange OAuth code for access token.

        Args:
            code: OAuth authorization code
            redirect_uri: OAuth redirect URI
            client_id: Slack client ID
            client_secret: Slack client secret

        Returns:
            OAuth response with access token
        """
        # For OAuth token exchange, we don't use the instance token
        # We'll use form data instead of JSON
        data = {
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        }

        # Use custom headers without Authorization
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        response = await self._make_request(
            "POST", "oauth.v2.access", data=data, headers=headers
        )
        return response

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

    async def get_all_channels(
        self,
        limit: int = 1000,
        types: str = "public_channel,private_channel",
        exclude_archived: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get all channels in the workspace with pagination.

        Args:
            limit: Maximum number of channels to fetch in total
            types: Channel types to include (comma-separated)
            exclude_archived: Whether to exclude archived channels

        Returns:
            List of all channels up to the limit
        """
        all_channels = []
        cursor = None
        page_limit = min(limit, 200)  # Each page request limit

        while len(all_channels) < limit:
            response = await self.get_channels(
                cursor=cursor,
                limit=page_limit,
                types=types,
                exclude_archived=exclude_archived,
            )

            channels = response.get("channels", [])
            all_channels.extend(channels)

            # Get cursor for next page
            metadata = response.get("response_metadata", {})
            cursor = metadata.get("next_cursor")

            # Break if no more results or we've reached the limit
            if not cursor or not channels:
                break

        return all_channels[:limit]

    async def get_all_users(
        self,
        limit: int = 1000,
        include_locale: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get all users in the workspace with pagination.

        Args:
            limit: Maximum number of users to fetch in total
            include_locale: Whether to include locale information

        Returns:
            List of all users up to the limit
        """
        all_users = []
        cursor = None
        page_limit = min(limit, 200)  # Each page request limit

        while len(all_users) < limit:
            # Remove None values and convert boolean values to strings to avoid URL encoding errors
            params = {
                "limit": page_limit,
                "include_locale": "true" if include_locale else "false"  # Convert bool to string
            }
            if cursor:
                params["cursor"] = cursor
            
            response = await self._make_request(
                "GET",
                "users.list",
                params=params,
            )

            users = response.get("members", [])
            all_users.extend(users)

            # Get cursor for next page
            metadata = response.get("response_metadata", {})
            cursor = metadata.get("next_cursor")

            # Break if no more results or we've reached the limit
            if not cursor or not users:
                break

        return all_users[:limit]

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
            "exclude_archived": "true" if exclude_archived else "false"
        }

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
            "inclusive": "true" if inclusive else "false",  # Convert boolean to string
        }

        if cursor:
            params["cursor"] = cursor

        return await self._make_request("GET", "conversations.replies", params=params)
