"""Camera schemas — request/response models for camera management."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    camera_type: str = Field(..., pattern=r"^(sparsh_5g|rtsp|ip_camera|webcam)$")
    ip_address: Optional[str] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    rtsp_path: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    rtsp_path: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CameraResponse(BaseModel):
    id: uuid.UUID
    name: str
    camera_type: str
    ip_address: Optional[str] = None
    port: Optional[int] = None
    rtsp_url: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    last_connected_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CameraConnectionTest(BaseModel):
    camera_id: uuid.UUID
    status: str  # success, failed, timeout
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    stream_info: Optional[dict] = None
