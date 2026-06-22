"""Alerts API — alert feed, acknowledgment, and statistics."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertAcknowledge, AlertListResponse, AlertStats

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/", response_model=AlertListResponse)
async def list_alerts(
    level: str | None = None,
    alert_type: str | None = None,
    acknowledged: bool | None = None,
    video_id: uuid.UUID | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get alert feed with filtering."""
    query = select(Alert).order_by(desc(Alert.created_at))

    if level:
        query = query.where(Alert.level == level)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)
    if video_id:
        query = query.where(Alert.video_id == video_id)

    # Total count
    count_q = select(func.count()).select_from(Alert)
    if level:
        count_q = count_q.where(Alert.level == level)
    total = (await db.execute(count_q)).scalar() or 0

    # Unacknowledged count
    unack_q = select(func.count()).select_from(Alert).where(Alert.acknowledged == False)
    unack_count = (await db.execute(unack_q)).scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return AlertListResponse(
        alerts=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        unacknowledged_count=unack_count,
    )


@router.get("/stats", response_model=AlertStats)
async def get_alert_stats(db: AsyncSession = Depends(get_db)):
    """Get alert statistics."""
    total = (await db.execute(select(func.count()).select_from(Alert))).scalar() or 0

    level_counts = {}
    for level in ["info", "warning", "high", "critical"]:
        q = select(func.count()).select_from(Alert).where(Alert.level == level)
        level_counts[level] = (await db.execute(q)).scalar() or 0

    false_alarms = (await db.execute(
        select(func.count()).select_from(Alert).where(Alert.is_false_alarm == True)
    )).scalar() or 0

    return AlertStats(
        total=total,
        info=level_counts["info"],
        warning=level_counts["warning"],
        high=level_counts["high"],
        critical=level_counts["critical"],
        false_alarm_rate=false_alarms / max(total, 1),
        avg_lead_time_seconds=0.0,  # Computed when forecasts are linked
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get alert details."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: uuid.UUID,
    data: AlertAcknowledge,
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = data.acknowledged_by
    alert.acknowledged_at = datetime.utcnow()
    await db.flush()
    return {"message": "Alert acknowledged", "alert_id": str(alert_id)}


@router.post("/{alert_id}/false-alarm")
async def mark_false_alarm(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Mark an alert as a false alarm (used for improving thresholds)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_false_alarm = True
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    await db.flush()
    return {"message": "Marked as false alarm", "alert_id": str(alert_id)}
