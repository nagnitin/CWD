"""CrowdMetric model — per-frame, per-zone crowd analytics."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrowdMetric(Base):
    __tablename__ = "crowd_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("videos.id"), index=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cameras.id"), index=True)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)  # seconds from start
    zone_id: Mapped[str | None] = mapped_column(String(100), index=True)  # Auto-discovered zone identifier

    # ─── Detection Metrics ─────────────────────────────────────
    person_count: Mapped[int] = mapped_column(Integer, default=0)
    detection_confidence_avg: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── Density Metrics ───────────────────────────────────────
    density: Mapped[float] = mapped_column(Float, default=0.0)          # persons per sq meter (estimated)
    density_level: Mapped[str] = mapped_column(String(20), default="low")  # low, moderate, high, extreme
    occupancy: Mapped[float] = mapped_column(Float, default=0.0)        # 0.0 to 1.0 fill ratio

    # ─── Flow Metrics ──────────────────────────────────────────
    velocity_avg: Mapped[float] = mapped_column(Float, default=0.0)     # pixels/frame
    velocity_max: Mapped[float] = mapped_column(Float, default=0.0)
    flow_direction: Mapped[float] = mapped_column(Float, default=0.0)   # dominant direction in degrees
    flow_consistency: Mapped[float] = mapped_column(Float, default=0.0) # 0.0 (chaotic) to 1.0 (uniform)
    counter_flow_ratio: Mapped[float] = mapped_column(Float, default=0.0)  # fraction moving opposite

    # ─── Pressure & Risk ───────────────────────────────────────
    density_growth_rate: Mapped[float] = mapped_column(Float, default=0.0)
    speed_drop: Mapped[float] = mapped_column(Float, default=0.0)       # relative to normal
    pressure_score: Mapped[float] = mapped_column(Float, default=0.0)   # 0 to 100
    flow_conflict: Mapped[float] = mapped_column(Float, default=0.0)    # 0 to 1
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)       # CRI: 0 to 100
    risk_level: Mapped[str] = mapped_column(String(20), default="safe")  # safe, moderate, high, critical

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
