"""
Channel data cache to reduce redundant fetching during analysis.
"""

import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ChannelDataCache:
    """
    A simple in-memory cache for channel data to avoid redundant fetching
    during multi-channel analysis.

    This cache stores channel data with time-based expiration to ensure
    freshness while avoiding duplicate database queries and API calls.
    """

    # Static class variable to hold the cache data
    _cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_cache_key(
        cls,
        channel_id: str,
        start_date: datetime,
        end_date: datetime,
        include_threads: bool = True,
    ) -> str:
        """
        Generate a unique cache key for the data request.

        Args:
            channel_id: Channel ID
            start_date: Analysis period start date
            end_date: Analysis period end date
            include_threads: Whether thread replies are included

        Returns:
            Unique string key for caching
        """
        start_str = start_date.isoformat() if start_date else "none"
        end_str = end_date.isoformat() if end_date else "none"
        threads_str = "with_threads" if include_threads else "no_threads"

        return f"{channel_id}:{start_str}:{end_str}:{threads_str}"

    @classmethod
    def get(
        cls,
        channel_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_threads: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve channel data from cache if available and not expired.

        Args:
            channel_id: Channel ID
            start_date: Analysis period start date
            end_date: Analysis period end date
            include_threads: Whether thread replies are included

        Returns:
            Cached channel data or None if not available
        """
        cache_key = cls.get_cache_key(channel_id, start_date, end_date, include_threads)

        if cache_key in cls._cache:
            cache_entry = cls._cache[cache_key]
            now = time.time()

            # Check if cache entry has expired (default 5 minute TTL)
            if now - cache_entry["timestamp"] < 300:  # 5 minutes in seconds
                logger.info(f"Cache hit for channel {channel_id}")
                return cache_entry["data"]
            else:
                # Remove expired entry
                logger.info(f"Cache expired for channel {channel_id}")
                del cls._cache[cache_key]

        return None

    @classmethod
    def set(
        cls,
        channel_id: str,
        data: Dict[str, Any],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_threads: bool = True,
    ) -> None:
        """
        Store channel data in cache.

        Args:
            channel_id: Channel ID
            data: The channel data to cache
            start_date: Analysis period start date
            end_date: Analysis period end date
            include_threads: Whether thread replies are included
        """
        cache_key = cls.get_cache_key(channel_id, start_date, end_date, include_threads)

        cls._cache[cache_key] = {"data": data, "timestamp": time.time()}

        logger.info(f"Cached data for channel {channel_id}")

        # Simple cache size management - keep only the most recent 50 entries
        if len(cls._cache) > 50:
            # Sort by timestamp and remove oldest entries
            sorted_keys = sorted(
                cls._cache.keys(), key=lambda k: cls._cache[k]["timestamp"]
            )

            # Remove oldest entries to keep cache size at 50
            for old_key in sorted_keys[: len(cls._cache) - 50]:
                del cls._cache[old_key]

    @classmethod
    def invalidate(cls, channel_id: str) -> None:
        """
        Invalidate all cache entries for a specific channel.

        Args:
            channel_id: Channel ID to invalidate
        """
        keys_to_remove = [
            k for k in cls._cache.keys() if k.startswith(f"{channel_id}:")
        ]

        for key in keys_to_remove:
            del cls._cache[key]

        logger.info(
            f"Invalidated {len(keys_to_remove)} cache entries for channel {channel_id}"
        )
