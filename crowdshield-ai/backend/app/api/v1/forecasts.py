"""Forecasts API — spatio-temporal prediction results."""

import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.forecast import Forecast
from app.schemas.forecast import ForecastResponse, ForecastSet

router = APIRouter(prefix="/forecasts", tags=["Forecasts"])


@router.get("/", response_model=list[ForecastResponse])
async def list_forecasts(
    video_id: uuid.UUID | None = None,
    zone_id: str | None = None,
    horizon_minutes: int | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get forecast results with filtering."""
    query = select(Forecast).order_by(desc(Forecast.created_at))

    if video_id:
        query = query.where(Forecast.video_id == video_id)
    if zone_id:
        query = query.where(Forecast.zone_id == zone_id)
    if horizon_minutes:
        query = query.where(Forecast.horizon_minutes == horizon_minutes)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/latest")
async def get_latest_forecasts(
    video_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get latest forecasts grouped by horizon."""
    base_query = select(Forecast).order_by(desc(Forecast.created_at))
    if video_id:
        base_query = base_query.where(Forecast.video_id == video_id)

    result = await db.execute(base_query.limit(100))
    all_forecasts = result.scalars().all()

    grouped = {"1m": [], "3m": [], "5m": []}
    for f in all_forecasts:
        key = f"{f.horizon_minutes}m"
        if key in grouped and len(grouped[key]) < 20:
            grouped[key].append(ForecastResponse.model_validate(f))

    return grouped
