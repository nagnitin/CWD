"""Crowd API — crowd metrics, risk index, and zone analytics."""

import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.crowd_metric import CrowdMetric
from app.schemas.crowd import CrowdMetricResponse, CrowdRiskIndex

router = APIRouter(prefix="/crowd", tags=["Crowd Analytics"])


@router.get("/metrics", response_model=list[CrowdMetricResponse])
async def get_crowd_metrics(
    video_id: uuid.UUID | None = None,
    camera_id: uuid.UUID | None = None,
    zone_id: str | None = None,
    frame_start: int | None = None,
    frame_end: int | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get crowd metrics with filtering."""
    query = select(CrowdMetric).order_by(desc(CrowdMetric.created_at))

    if video_id:
        query = query.where(CrowdMetric.video_id == video_id)
    if camera_id:
        query = query.where(CrowdMetric.camera_id == camera_id)
    if zone_id:
        query = query.where(CrowdMetric.zone_id == zone_id)
    if frame_start is not None:
        query = query.where(CrowdMetric.frame_number >= frame_start)
    if frame_end is not None:
        query = query.where(CrowdMetric.frame_number <= frame_end)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/latest", response_model=CrowdMetricResponse | None)
async def get_latest_metrics(
    video_id: uuid.UUID | None = None,
    camera_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent crowd metric snapshot."""
    query = select(CrowdMetric).order_by(desc(CrowdMetric.created_at)).limit(1)
    if video_id:
        query = query.where(CrowdMetric.video_id == video_id)
    if camera_id:
        query = query.where(CrowdMetric.camera_id == camera_id)

    result = await db.execute(query)
    return result.scalar_one_or_none()


@router.get("/risk-summary")
async def get_risk_summary(
    video_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated risk summary across all zones."""
    query = select(CrowdMetric).order_by(desc(CrowdMetric.created_at)).limit(50)
    if video_id:
        query = query.where(CrowdMetric.video_id == video_id)

    result = await db.execute(query)
    metrics = result.scalars().all()

    if not metrics:
        return {
            "overall_risk": 0,
            "risk_level": "safe",
            "total_persons": 0,
            "zones_at_risk": 0,
            "max_density": 0,
        }

    latest = metrics[0]
    high_risk_count = sum(1 for m in metrics if m.risk_score > 50)

    return {
        "overall_risk": latest.risk_score,
        "risk_level": latest.risk_level,
        "total_persons": latest.person_count,
        "zones_at_risk": high_risk_count,
        "max_density": max(m.density for m in metrics),
        "avg_velocity": sum(m.velocity_avg for m in metrics) / len(metrics),
        "max_pressure": max(m.pressure_score for m in metrics),
    }


@router.get("/timeline")
async def get_risk_timeline(
    video_id: uuid.UUID,
    interval_frames: int = Query(default=30, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get CRI timeline for charting."""
    query = (
        select(CrowdMetric)
        .where(CrowdMetric.video_id == video_id)
        .order_by(CrowdMetric.frame_number)
    )
    result = await db.execute(query)
    metrics = result.scalars().all()

    # Sample at interval
    timeline = []
    for i, m in enumerate(metrics):
        if i % interval_frames == 0:
            timeline.append({
                "frame": m.frame_number,
                "timestamp": m.timestamp,
                "risk_score": m.risk_score,
                "risk_level": m.risk_level,
                "person_count": m.person_count,
                "density": m.density,
                "pressure": m.pressure_score,
            })

    return timeline
