"""
CrowdShield AI — Redis Client
Async Redis connection for caching, pub/sub, and real-time state.
"""

import redis.asyncio as aioredis

from app.config import settings

redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Get the global Redis client instance."""
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return redis_client


async def close_redis():
    """Close the Redis connection."""
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None
