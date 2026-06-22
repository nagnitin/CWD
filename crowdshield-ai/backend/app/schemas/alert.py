"""Alert schemas — alert feed, details, and response actions."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: uuid.UUID
    video_id: Optional[uuid.UUID] = None
    camera_id: Optional[uuid.UUID] = None
    level: str
    alert_type: str
    zone: Optional[str] = None
    reason: str
    confidence: float
    prediction_horizon: Optional[str] = None
    recommended_action: Optional[str] = None
    confirmation_frames: int
    persistence_seconds: float
    fused_confidence: float
    acknowledged: bool
    resolved: bool
    is_false_alarm: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertAcknowledge(BaseModel):
    acknowledged_by: str


class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    total: int
    unacknowledged_count: int


class AlertStats(BaseModel):
    total: int
    info: int
    warning: int
    high: int
    critical: int
    false_alarm_rate: float
    avg_lead_time_seconds: float
