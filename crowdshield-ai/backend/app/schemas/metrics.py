"""Metrics schemas — system health, 5G analytics, and performance."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SystemHealthResponse(BaseModel):
    cpu_utilization: float
    gpu_utilization: float
    memory_utilization: float
    disk_utilization: float
    inference_fps: float
    active_streams: int
    deployment_mode: str
    mec_status: str
    uptime_seconds: float
    timestamp: datetime


class LatencyBreakdown(BaseModel):
    camera_latency_ms: float
    mec_latency_ms: float
    inference_latency_ms: float
    alert_latency_ms: float
    e2e_latency_ms: float
    timestamp: datetime


class NetworkMetrics(BaseModel):
    throughput_mbps: float
    packet_loss_percent: float
    bandwidth_consumption_mbps: float
    jitter_ms: float
    deployment_mode: str
    timestamp: datetime


class CloudVsMECComparison(BaseModel):
    metric: str
    cloud_value: float
    mec_value: float
    improvement_percent: float
    unit: str


class PerformanceSummary(BaseModel):
    avg_inference_fps: float
    avg_e2e_latency_ms: float
    avg_detection_confidence: float
    total_frames_processed: int
    total_alerts_generated: int
    false_alarm_rate: float
    uptime_percent: float


class SettingsResponse(BaseModel):
    yolo_model: str
    yolo_confidence: float
    yolo_iou_threshold: float
    default_processing_fps: int
    device: str
    mec_enabled: bool
    adaptive_fps_safe: int
    adaptive_fps_moderate: int
    adaptive_fps_high: int
    adaptive_fps_critical: int
    cri_safe_max: int
    cri_moderate_max: int
    cri_high_max: int
    alert_min_confirmation_frames: int
    alert_persistence_seconds: float


class SettingsUpdate(BaseModel):
    yolo_confidence: Optional[float] = None
    yolo_iou_threshold: Optional[float] = None
    default_processing_fps: Optional[int] = None
    device: Optional[str] = None
    mec_enabled: Optional[bool] = None
    alert_min_confirmation_frames: Optional[int] = None
    alert_persistence_seconds: Optional[float] = None
