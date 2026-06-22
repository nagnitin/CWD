"""Camera model — Sparsh 5G, RTSP, IP Camera, Webcam sources."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    camera_type: Mapped[str] = mapped_column(String(50), nullable=False)  # sparsh_5g, rtsp, ip_camera, webcam
    ip_address: Mapped[str | None] = mapped_column(String(45))
    port: Mapped[int | None] = mapped_column(Integer)
    username: Mapped[str | None] = mapped_column(String(100))
    password: Mapped[str | None] = mapped_column(String(255))
    rtsp_path: Mapped[str | None] = mapped_column(String(500))
    rtsp_url: Mapped[str | None] = mapped_column(Text)  # Generated: rtsp://user:pass@ip:port/path
    location: Mapped[str | None] = mapped_column(String(255))  # Physical location description
    latitude: Mapped[float | None] = mapped_column()
    longitude: Mapped[float | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(50), default="disconnected")
    # Status values: connected, disconnected, reconnecting, low_signal, packet_loss, stream_delay
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
