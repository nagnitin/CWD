"""V1 Router — aggregates all v1 API endpoints."""

from fastapi import APIRouter

from app.api.v1.videos import router as videos_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.crowd import router as crowd_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.forecasts import router as forecasts_router
from app.api.v1.hazards import router as hazards_router
from app.api.v1.system import router as system_router

router = APIRouter()

router.include_router(videos_router)
router.include_router(cameras_router)
router.include_router(crowd_router)
router.include_router(alerts_router)
router.include_router(forecasts_router)
router.include_router(hazards_router)
router.include_router(system_router)
