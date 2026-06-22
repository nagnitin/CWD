"""Hazard model — detected environmental hazards with motion state tracking."""

import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, func, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Hazard(Base):
    __tablename__ = "hazards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # ─── Detection Info ────────────────────────────────────────
    hazard_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # Types: light_pole, electric_pole, tree, barricade, stage, scaffolding,
    #        signboard, temporary_structure, fence, overhead_installation
    class_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bbox: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {x1, y1, x2, y2}
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── Motion State Machine ──────────────────────────────────
    motion_state: Mapped[str] = mapped_column(String(50), default="static")
    # States: static, monitoring, alerting, critical
    # static → already tilted, ignore
    # monitoring → started moving, watch
    # alerting → continues bending, alert
    # critical → movement accelerating, critical alert

    motion_delta: Mapped[float] = mapped_column(Float, default=0.0)        # cumulative displacement
    motion_velocity: Mapped[float] = mapped_column(Float, default=0.0)     # current motion speed
    motion_acceleration: Mapped[float] = mapped_column(Float, default=0.0) # is it getting worse?
    motion_history: Mapped[dict | None] = mapped_column(JSONB)  # Array of {frame, delta, velocity}

    # ─── Status ────────────────────────────────────────────────
    severity: Mapped[str] = mapped_column(String(20), default="none")  # none, low, medium, high, critical
    status: Mapped[str] = mapped_column(String(50), default="detected")  # detected, tracking, resolved, false_alarm
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
