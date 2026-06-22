"""Crowd schemas — crowd metrics, zones, risk index, and pressure."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CrowdMetricResponse(BaseModel):
    id: uuid.UUID
    video_id: Optional[uuid.UUID] = None
    camera_id: Optional[uuid.UUID] = None
    frame_number: int
    timestamp: float
    zone_id: Optional[str] = None
    person_count: int
    detection_confidence_avg: float
    density: float
    density_level: str
    occupancy: float
    velocity_avg: float
    flow_direction: float
    flow_consistency: float
    counter_flow_ratio: float
    density_growth_rate: float
    speed_drop: float
    pressure_score: float
    flow_conflict: float
    risk_score: float
    risk_level: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ZoneMetrics(BaseModel):
    zone_id: str
    bbox: dict  # {x1, y1, x2, y2}
    person_count: int
    density: float
    occupancy: float
    velocity_avg: float
    flow_consistency: float
    growth_rate: float
    pressure_score: float
    risk_score: float
    risk_level: str


class CrowdRiskIndex(BaseModel):
    overall_cri: float  # 0-100
    risk_level: str  # safe, moderate, high, critical
    components: dict  # density, density_growth, speed_drop, pressure, flow_conflict, occupancy
    zones: list[ZoneMetrics]
    timestamp: float
    frame_number: int


class CrowdSnapshot(BaseModel):
    """Real-time crowd state pushed via WebSocket."""
    frame_number: int
    timestamp: float
    total_persons: int
    overall_cri: float
    risk_level: str
    zones: list[ZoneMetrics]
    detections: list[dict]  # [{bbox, confidence, track_id, velocity, direction}]
    heatmap_url: Optional[str] = None
    flow_arrows: Optional[list[dict]] = None
    forecasts: Optional[dict] = None


class TrackInfo(BaseModel):
    track_id: int
    bbox: dict
    velocity: float
    direction: float
    duration_frames: int
    trajectory: list[dict]  # [{x, y, frame}]
