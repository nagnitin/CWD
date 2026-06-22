"""Hazard schemas — environmental hazard detection and tracking."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HazardResponse(BaseModel):
    id: uuid.UUID
    video_id: Optional[uuid.UUID] = None
    camera_id: Optional[uuid.UUID] = None
    frame_number: int
    hazard_type: str
    class_name: str
    bbox: dict
    confidence: float
    motion_state: str
    motion_delta: float
    motion_velocity: float
    motion_acceleration: float
    severity: str
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class HazardListResponse(BaseModel):
    hazards: list[HazardResponse]
    total: int
    active_count: int
    critical_count: int
