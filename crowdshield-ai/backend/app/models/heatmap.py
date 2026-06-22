"""Heatmap model — density heatmap snapshots (current and predicted)."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, func, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Heatmap(Base):
    __tablename__ = "heatmaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # ─── Heatmap Type ─────────────────────────────────────────
    heatmap_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Types: current, forecast_1m, forecast_3m, forecast_5m, flow, pressure
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)

    # ─── Data ─────────────────────────────────────────────────
    data_blob: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # Compressed numpy array or PNG
    encoding: Mapped[str] = mapped_column(String(20), default="png")  # png, numpy_compressed
    max_value: Mapped[float] = mapped_column(Float, default=0.0)
    min_value: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
