"""Alert model — multi-level alerts with false alarm prevention metadata."""

import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Boolean, func, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)

    # ─── Alert Classification ─────────────────────────────────
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Levels: info, warning, high, critical
    alert_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # Types: crowd_density, crowd_pressure, stampede_risk, hazard_movement,
    #        panic_detected, reverse_flow, bottleneck, forecast_warning

    # ─── Alert Details ─────────────────────────────────────────
    zone: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    prediction_horizon: Mapped[str | None] = mapped_column(String(50))  # "now", "+1min", "+3min", "+5min"
    recommended_action: Mapped[str | None] = mapped_column(Text)
    # Actions: open_exit, reduce_entry, deploy_security, divert_crowd,
    #          start_evacuation, close_gate, open_emergency_corridor

    # ─── False Alarm Prevention Metadata ───────────────────────
    confirmation_frames: Mapped[int] = mapped_column(Integer, default=0)
    persistence_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    bayesian_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    fused_confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── Evidence ──────────────────────────────────────────────
    evidence: Mapped[dict | None] = mapped_column(JSONB)  # Snapshots, metrics that triggered

    # ─── Status ────────────────────────────────────────────────
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(100))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_false_alarm: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
