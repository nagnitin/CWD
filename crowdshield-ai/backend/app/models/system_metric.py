"""SystemMetric model — infrastructure health and 5G network analytics."""

import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SystemMetric(Base):
    __tablename__ = "system_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # ─── Compute Resources ─────────────────────────────────────
    cpu_utilization: Mapped[float] = mapped_column(Float, default=0.0)      # percentage
    gpu_utilization: Mapped[float] = mapped_column(Float, default=0.0)      # percentage
    memory_utilization: Mapped[float] = mapped_column(Float, default=0.0)   # percentage
    disk_utilization: Mapped[float] = mapped_column(Float, default=0.0)     # percentage

    # ─── Processing Performance ────────────────────────────────
    inference_fps: Mapped[float] = mapped_column(Float, default=0.0)
    active_streams: Mapped[int] = mapped_column(Integer, default=0)
    frames_processed: Mapped[int] = mapped_column(Integer, default=0)
    processing_fps_target: Mapped[int] = mapped_column(Integer, default=10)

    # ─── Latency Breakdown ─────────────────────────────────────
    camera_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)     # Camera → MEC
    mec_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)        # MEC processing
    inference_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)   # Model inference
    alert_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)      # Alert generation
    e2e_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)        # End-to-end

    # ─── Network (5G) ─────────────────────────────────────────
    network_throughput_mbps: Mapped[float] = mapped_column(Float, default=0.0)
    packet_loss_percent: Mapped[float] = mapped_column(Float, default=0.0)
    bandwidth_consumption_mbps: Mapped[float] = mapped_column(Float, default=0.0)
    jitter_ms: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── MEC Status ───────────────────────────────────────────
    mec_status: Mapped[str] = mapped_column(String(50), default="simulated")
    # Values: active, standby, overloaded, simulated
    deployment_mode: Mapped[str] = mapped_column(String(50), default="local")
    # Values: local, mec, cloud
