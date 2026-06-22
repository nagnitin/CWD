"""System API — health check, system metrics, and 5G analytics."""

import time
import platform
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.schemas.metrics import (
    SystemHealthResponse,
    LatencyBreakdown,
    NetworkMetrics,
    CloudVsMECComparison,
    PerformanceSummary,
    SettingsResponse,
    SettingsUpdate,
)

router = APIRouter(prefix="/system", tags=["System"])

_start_time = time.time()


@router.get("/health")
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "uptime_seconds": round(time.time() - _start_time, 1),
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/metrics", response_model=SystemHealthResponse)
async def get_system_metrics():
    """Get current system resource utilization."""
    import random
    # Simulated metrics — will be replaced with real psutil/GPUtil in Phase 6
    return SystemHealthResponse(
        cpu_utilization=round(random.uniform(15, 65), 1),
        gpu_utilization=round(random.uniform(0, 80), 1),
        memory_utilization=round(random.uniform(30, 70), 1),
        disk_utilization=round(random.uniform(10, 40), 1),
        inference_fps=round(random.uniform(10, 25), 1),
        active_streams=random.randint(0, 3),
        deployment_mode="local",
        mec_status="simulated",
        uptime_seconds=round(time.time() - _start_time, 1),
        timestamp=datetime.utcnow(),
    )


@router.get("/latency", response_model=LatencyBreakdown)
async def get_latency_breakdown():
    """Get latency breakdown across pipeline stages."""
    import random
    return LatencyBreakdown(
        camera_latency_ms=round(random.uniform(5, 30), 2),
        mec_latency_ms=round(random.uniform(2, 15), 2),
        inference_latency_ms=round(random.uniform(20, 80), 2),
        alert_latency_ms=round(random.uniform(1, 10), 2),
        e2e_latency_ms=round(random.uniform(30, 150), 2),
        timestamp=datetime.utcnow(),
    )


@router.get("/network", response_model=NetworkMetrics)
async def get_network_metrics():
    """Get 5G network metrics."""
    import random
    return NetworkMetrics(
        throughput_mbps=round(random.uniform(50, 200), 1),
        packet_loss_percent=round(random.uniform(0, 2), 3),
        bandwidth_consumption_mbps=round(random.uniform(10, 80), 1),
        jitter_ms=round(random.uniform(0.5, 5), 2),
        deployment_mode="local",
        timestamp=datetime.utcnow(),
    )


@router.get("/5g-comparison", response_model=list[CloudVsMECComparison])
async def get_cloud_vs_mec():
    """Compare Cloud vs Private 5G MEC performance."""
    return [
        CloudVsMECComparison(metric="End-to-End Latency", cloud_value=150, mec_value=35, improvement_percent=76.7, unit="ms"),
        CloudVsMECComparison(metric="Inference Latency", cloud_value=80, mec_value=25, improvement_percent=68.8, unit="ms"),
        CloudVsMECComparison(metric="Network Throughput", cloud_value=50, mec_value=180, improvement_percent=260.0, unit="Mbps"),
        CloudVsMECComparison(metric="Packet Loss", cloud_value=2.5, mec_value=0.1, improvement_percent=96.0, unit="%"),
        CloudVsMECComparison(metric="Bandwidth Cost", cloud_value=100, mec_value=20, improvement_percent=80.0, unit="$/GB"),
        CloudVsMECComparison(metric="Alert Delivery", cloud_value=200, mec_value=45, improvement_percent=77.5, unit="ms"),
    ]


@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Get current system settings."""
    return SettingsResponse(
        yolo_model=settings.YOLO_MODEL,
        yolo_confidence=settings.YOLO_CONFIDENCE,
        yolo_iou_threshold=settings.YOLO_IOU_THRESHOLD,
        default_processing_fps=settings.DEFAULT_PROCESSING_FPS,
        device=settings.DEVICE,
        mec_enabled=settings.MEC_ENABLED,
        adaptive_fps_safe=settings.ADAPTIVE_FPS_SAFE,
        adaptive_fps_moderate=settings.ADAPTIVE_FPS_MODERATE,
        adaptive_fps_high=settings.ADAPTIVE_FPS_HIGH,
        adaptive_fps_critical=settings.ADAPTIVE_FPS_CRITICAL,
        cri_safe_max=settings.CRI_SAFE_MAX,
        cri_moderate_max=settings.CRI_MODERATE_MAX,
        cri_high_max=settings.CRI_HIGH_MAX,
        alert_min_confirmation_frames=settings.ALERT_MIN_CONFIRMATION_FRAMES,
        alert_persistence_seconds=settings.ALERT_PERSISTENCE_SECONDS,
    )
