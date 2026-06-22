"""
CrowdShield AI — Main Application
FastAPI application factory with lifespan management, CORS, and route registration.
"""

import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.redis_client import get_redis, close_redis
from app.api.v1.router import router as v1_router
from app.ws.live_feed import router as ws_router, redis_broadcast_listener

logger = logging.getLogger("crowdshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # ─── Startup ──────────────────────────────────────────────
    logger.info("🚀 CrowdShield AI starting up...")

    # Initialize database tables (dev mode)
    await init_db()
    logger.info("✅ Database initialized")

    # Initialize Redis
    await get_redis()
    logger.info("✅ Redis connected")

    # Start Redis WebSocket broadcast listener
    broadcast_task = asyncio.create_task(redis_broadcast_listener())
    app.state.broadcast_task = broadcast_task
    logger.info("✅ Redis WebSocket broadcast listener started")

    # Ensure upload directory exists
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.model_path.mkdir(parents=True, exist_ok=True)
    logger.info("✅ Storage directories ready")

    logger.info(f"🛡️  {settings.APP_NAME} v{settings.APP_VERSION} is running")

    yield

    # ─── Shutdown ─────────────────────────────────────────────
    logger.info("🔄 CrowdShield AI shutting down...")
    
    # Cancel broadcast task
    if hasattr(app.state, "broadcast_task"):
        app.state.broadcast_task.cancel()
        try:
            await app.state.broadcast_task
        except asyncio.CancelledError:
            pass
        logger.info("✅ Redis WebSocket broadcast listener stopped")

    await close_redis()
    logger.info("👋 Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Digital Twin Assisted Crowd Risk Forecasting, "
            "Hazard Detection and Early Warning System "
            "over Private 5G MEC Infrastructure"
        ),
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # ─── CORS ─────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── API Routes ───────────────────────────────────────────
    app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

    # ─── WebSocket Routes ─────────────────────────────────────
    app.include_router(ws_router)

    # ─── Static File Serving (uploads) ────────────────────────
    try:
        app.mount(
            "/uploads",
            StaticFiles(directory=str(settings.upload_path)),
            name="uploads",
        )
    except Exception:
        pass  # Directory may not exist yet in some environments

    # ─── Root Endpoint ────────────────────────────────────────
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "operational",
            "docs": "/api/docs",
        }

    return app


# Application instance
app = create_app()
