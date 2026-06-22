"""Video model — uploaded video files with metadata."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, BigInteger, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    filepath: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)  # bytes
    mime_type: Mapped[str | None] = mapped_column(String(100))
    duration: Mapped[float | None] = mapped_column(Float)  # seconds
    fps: Mapped[float | None] = mapped_column(Float)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    bitrate: Mapped[int | None] = mapped_column(Integer)  # kbps
    codec: Mapped[str | None] = mapped_column(String(50))
    total_frames: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="uploaded")
    # Status values: uploaded, processing, processed, failed
    processing_progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0 to 100.0
    error_message: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
