"""Forecast model — spatio-temporal predictions at +1, +3, +5 minute horizons."""

import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, func, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # ─── Forecast Parameters ──────────────────────────────────
    zone_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    horizon_minutes: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 3, 5
    model_name: Mapped[str] = mapped_column(String(100), default="stgcn")

    # ─── Predicted Values ─────────────────────────────────────
    predicted_density: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_count: Mapped[int] = mapped_column(Integer, default=0)
    predicted_risk: Mapped[float] = mapped_column(Float, default=0.0)        # CRI 0-100
    predicted_pressure: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_velocity: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_risk_level: Mapped[str] = mapped_column(String(20), default="safe")
    is_bottleneck: Mapped[bool] = mapped_column(default=False)
    is_congestion: Mapped[bool] = mapped_column(default=False)

    # ─── Confidence ───────────────────────────────────────────
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    uncertainty: Mapped[float] = mapped_column(Float, default=0.0)
    prediction_details: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
