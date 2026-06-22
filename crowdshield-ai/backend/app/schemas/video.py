"""Video schemas — request/response models for video upload and management."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VideoUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_size: int
    status: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class VideoMetadata(BaseModel):
    duration: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    total_frames: Optional[int] = None


class VideoResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    filepath: str
    file_size: int
    mime_type: Optional[str] = None
    duration: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    total_frames: Optional[int] = None
    status: str
    processing_progress: float
    error_message: Optional[str] = None
    uploaded_at: datetime
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VideoProcessRequest(BaseModel):
    processing_fps: int = Field(default=10, ge=1, le=30)
    enable_tracking: bool = True
    enable_density: bool = True
    enable_flow: bool = True
    enable_hazard: bool = False
    enable_forecast: bool = False


class VideoListResponse(BaseModel):
    videos: list[VideoResponse]
    total: int
    page: int
    page_size: int
