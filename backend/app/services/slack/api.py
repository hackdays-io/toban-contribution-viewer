"""
Slack API client service for interacting with the Slack API.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import aiohttp
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.slack import SlackWorkspace

# Configure logging
logger = logging.getLogger(__name__)


class SlackApiError(Exception):
    """Exception raised for Slack API errors."""
    
    def __init__(self, message: str, error_code: Optional[str] = None, 
                response_data: Optional[Dict[str, Any]] = None):
        self.message = message
        self.error_code = error_code
        self.response_data = response_data
        super().__init__(self.message)


class SlackApiRateLimitError(SlackApiError):
    """Exception raised for Slack API rate limit errors."""
    
    def __init__(self, message: str, retry_after: Optional[int] = None, 
                response_data: Optional[Dict[str, Any]] = None):
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
        
    async def _make_request(self, 
                           method: str, 
                           url_path: str, 
                           params: Optional[Dict[str, Any]] = None,
                           data: Optional[Dict[str, Any]] = None,
                           json_data: Optional[Dict[str, Any]] = None,
                           headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
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
                    timeout=10  # Set a reasonable timeout
                ) as response:
                    # Check for rate limiting
                    if response.status == 429:
                        retry_after = int(response.headers.get("Retry-After", 60))
                        logger.warning(f"Rate limited by Slack API. Retry after {retry_after} seconds.")
                        raise SlackApiRateLimitError(
                            message="Rate limited by Slack API",
                            retry_after=retry_after
                        )
                    
                    # Get response data
                    response_data = await response.json()
                    
                    # Check for API errors
                    if not response_data.get("ok", False):
                        error_code = response_data.get("error", "unknown_error")
                        error_msg = response_data.get("error_description", "Unknown API error")
                        
                        # Specific error handling
                        if error_code == "invalid_auth" or error_code == "token_expired":
                            logger.error(f"Authentication error: {error_code} - {error_msg}")
                            raise SlackApiError(
                                message=f"Slack authentication error: {error_msg}",
                                error_code=error_code,
                                response_data=response_data
                            )
                        
                        logger.error(f"Slack API error: {error_code} - {error_msg}")
                        raise SlackApiError(
                            message=f"Slack API error: {error_msg}",
                            error_code=error_code,
                            response_data=response_data
                        )
                    
                    return response_data
                    
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error during Slack API request: {str(e)}")
            raise SlackApiError(message=f"HTTP error during Slack API request: {str(e)}")
    
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
                params={"limit": 1}  # Just need the count, not actual users
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
            logger.info(f"Calling auth.test API with token: {self.access_token[:5]}...")
            response = await self._make_request("GET", "auth.test")
            logger.info(f"Token verification successful: {response}")
            return True
        except SlackApiError as e:
            logger.error(f"Token verification failed: {e.error_code} - {e.message}")
            if e.error_code in ["invalid_auth", "token_expired"]:
                return False
            # For other errors, the token might still be valid
            raise
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {str(e)}")
            # Re-raise the exception to be handled by the caller
            raise