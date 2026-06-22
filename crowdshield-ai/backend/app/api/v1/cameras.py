"""Cameras API — CRUD and connection testing for camera sources."""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.camera import Camera
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraConnectionTest,
)

router = APIRouter(prefix="/cameras", tags=["Cameras"])


def build_rtsp_url(camera: Camera) -> str | None:
    """Generate RTSP URL from camera config."""
    if not camera.ip_address:
        return None
    port = camera.port or 554
    auth = ""
    if camera.username and camera.password:
        auth = f"{camera.username}:{camera.password}@"
    path = camera.rtsp_path or "stream1"
    return f"rtsp://{auth}{camera.ip_address}:{port}/{path}"


@router.post("/", response_model=CameraResponse, status_code=201)
async def create_camera(
    data: CameraCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new camera source."""
    camera = Camera(
        name=data.name,
        camera_type=data.camera_type,
        ip_address=data.ip_address,
        port=data.port,
        username=data.username,
        password=data.password,
        rtsp_path=data.rtsp_path,
        location=data.location,
        latitude=data.latitude,
        longitude=data.longitude,
        status="disconnected",
    )
    camera.rtsp_url = build_rtsp_url(camera)
    db.add(camera)
    await db.flush()
    return camera


@router.get("/", response_model=list[CameraResponse])
async def list_cameras(
    camera_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all registered cameras."""
    query = select(Camera).order_by(Camera.created_at.desc())
    if camera_type:
        query = query.where(Camera.camera_type == camera_type)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get camera details by ID."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: uuid.UUID,
    data: CameraUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update camera configuration."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)
    camera.rtsp_url = build_rtsp_url(camera)
    await db.flush()
    return camera


@router.delete("/{camera_id}")
async def delete_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a camera."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    await db.delete(camera)
    return {"message": "Camera deleted successfully"}


@router.post("/{camera_id}/test", response_model=CameraConnectionTest)
async def test_connection(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Test camera connection and return stream info."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    # TODO: Actually test RTSP connection with OpenCV in Phase 2
    # For now, return simulated result
    import random
    success = random.random() > 0.3  # 70% success rate for simulation

    if success:
        camera.status = "connected"
        camera.last_connected_at = datetime.utcnow()
        return CameraConnectionTest(
            camera_id=camera_id,
            status="success",
            latency_ms=round(random.uniform(5, 50), 2),
            stream_info={
                "resolution": "1920x1080",
                "fps": 30,
                "codec": "H.264",
                "bitrate_kbps": 4000,
            },
        )
    else:
        camera.status = "disconnected"
        return CameraConnectionTest(
            camera_id=camera_id,
            status="failed",
            error_message="Connection timed out. Check IP address and credentials.",
        )
