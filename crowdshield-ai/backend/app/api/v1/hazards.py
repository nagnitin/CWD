"""Hazards API — environmental hazard listing and tracking."""

import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.hazard import Hazard
from app.schemas.hazard import HazardResponse, HazardListResponse

router = APIRouter(prefix="/hazards", tags=["Hazards"])


@router.get("/", response_model=HazardListResponse)
async def list_hazards(
    video_id: uuid.UUID | None = None,
    status: str | None = None,
    severity: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get detected hazards with filtering."""
    query = select(Hazard).order_by(desc(Hazard.created_at))

    if video_id:
        query = query.where(Hazard.video_id == video_id)
    if status:
        query = query.where(Hazard.status == status)
    if severity:
        query = query.where(Hazard.severity == severity)

    total = (await db.execute(select(func.count()).select_from(Hazard))).scalar() or 0
    active = (await db.execute(
        select(func.count()).select_from(Hazard).where(Hazard.status.in_(["detected", "tracking"]))
    )).scalar() or 0
    critical = (await db.execute(
        select(func.count()).select_from(Hazard).where(Hazard.severity == "critical")
    )).scalar() or 0

    query = query.limit(limit)
    result = await db.execute(query)
    hazards = result.scalars().all()

    return HazardListResponse(
        hazards=[HazardResponse.model_validate(h) for h in hazards],
        total=total,
        active_count=active,
        critical_count=critical,
    )


@router.get("/{hazard_id}", response_model=HazardResponse)
async def get_hazard(hazard_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get hazard details with motion history."""
    from fastapi import HTTPException
    result = await db.execute(select(Hazard).where(Hazard.id == hazard_id))
    hazard = result.scalar_one_or_none()
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")
    return hazard
