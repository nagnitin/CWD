"""Videos API — upload, list, retrieve, process, and stream videos."""

import uuid
import shutil
import subprocess
import json
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.models.video import Video
from app.schemas.video import (
    VideoUploadResponse,
    VideoResponse,
    VideoListResponse,
    VideoProcessRequest,
)

router = APIRouter(prefix="/videos", tags=["Videos"])


def extract_video_metadata(filepath: str) -> dict:
    """Extract video metadata using ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", filepath
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return {}
        data = json.loads(result.stdout)

        video_stream = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                video_stream = stream
                break

        if not video_stream:
            return {}

        # Parse FPS from r_frame_rate (e.g., "30/1")
        fps_str = video_stream.get("r_frame_rate", "0/1")
        fps_parts = fps_str.split("/")
        fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 and float(fps_parts[1]) > 0 else 0

        format_info = data.get("format", {})

        return {
            "duration": float(format_info.get("duration", 0)),
            "fps": round(fps, 2),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
            "bitrate": int(format_info.get("bit_rate", 0)) // 1000,  # Convert to kbps
            "codec": video_stream.get("codec_name", "unknown"),
            "total_frames": int(video_stream.get("nb_frames", 0)) or int(float(format_info.get("duration", 0)) * fps),
        }
    except Exception:
        return {}


@router.post("/upload", response_model=VideoUploadResponse, status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video file (MP4, AVI, MOV, MKV)."""
    # Validate file extension
    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{suffix}'. Allowed: {settings.ALLOWED_VIDEO_EXTENSIONS}"
        )

    # Generate unique filename
    video_id = uuid.uuid4()
    safe_filename = f"{video_id}{suffix}"
    upload_dir = settings.upload_path
    filepath = upload_dir / safe_filename

    # Save file
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size = filepath.stat().st_size

    # Extract metadata
    metadata = extract_video_metadata(str(filepath))

    # Create database record
    video = Video(
        id=video_id,
        filename=safe_filename,
        original_filename=file.filename,
        filepath=str(filepath),
        file_size=file_size,
        mime_type=file.content_type,
        duration=metadata.get("duration"),
        fps=metadata.get("fps"),
        width=metadata.get("width"),
        height=metadata.get("height"),
        bitrate=metadata.get("bitrate"),
        codec=metadata.get("codec"),
        total_frames=metadata.get("total_frames"),
        status="uploaded",
    )
    db.add(video)
    await db.flush()

    return video


@router.get("/", response_model=VideoListResponse)
async def list_videos(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded videos with pagination."""
    query = select(Video).order_by(Video.uploaded_at.desc())
    if status:
        query = query.where(Video.status == status)

    # Count total
    count_query = select(func.count()).select_from(Video)
    if status:
        count_query = count_query.where(Video.status == status)
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    videos = result.scalars().all()

    return VideoListResponse(
        videos=[VideoResponse.model_validate(v) for v in videos],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get video details by ID."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.get("/{video_id}/stream")
async def stream_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Stream video file for playback."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    filepath = Path(video.filepath)
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    return FileResponse(
        path=str(filepath),
        media_type=video.mime_type or "video/mp4",
        filename=video.original_filename,
    )


@router.post("/{video_id}/process")
async def process_video(
    video_id: uuid.UUID,
    request: VideoProcessRequest = VideoProcessRequest(),
    db: AsyncSession = Depends(get_db),
):
    """Start AI processing on an uploaded video."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.status == "processing":
        raise HTTPException(status_code=409, detail="Video is already being processed")

    # Update status
    video.status = "processing"
    video.processing_progress = 0.0
    await db.flush()

    # Submit to Celery worker in Phase 2
    from app.workers.video_processor import process_video_task
    process_video_task.delay(str(video_id), request.model_dump())

    return {
        "video_id": str(video_id),
        "status": "processing",
        "message": "Video processing started",
        "settings": request.model_dump(),
    }


@router.delete("/{video_id}")
async def delete_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a video and its file."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Delete file
    filepath = Path(video.filepath)
    if filepath.exists():
        filepath.unlink()

    await db.delete(video)
    return {"message": "Video deleted successfully"}
