"""
CrowdShield AI — Celery Video Processor Worker
Background tasks for executing the computer vision pipeline on uploaded videos.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime

from app.workers.celery_app import celery_app
from app.database import async_session_factory
from app.models.video import Video
from app.models.crowd_metric import CrowdMetric
from app.redis_client import get_redis
from ai.pipeline.video_pipeline import VideoPipeline

logger = logging.getLogger("crowdshield.workers.video_processor")


async def _process_video_async(video_id: str, settings_dict: dict):
    """Asynchronous video processing executor."""
    video_uuid = uuid.UUID(video_id)
    
    # 1. Fetch video path and update status to processing
    async with async_session_factory() as db:
        video = await db.get(Video, video_uuid)
        if not video:
            logger.error(f"Video {video_id} not found in database.")
            return {
                "video_id": video_id,
                "status": "failed",
                "error": "Video not found in database",
            }
        
        video.status = "processing"
        video.processing_progress = 0.0
        await db.commit()
        
        video_path = video.filepath
        processing_fps = settings_dict.get("processing_fps", 10)
        device = settings_dict.get("device", "auto")

    # 2. Set up event pipeline callbacks
    redis = await get_redis()

    async def on_frame(metrics: dict):
        # Save frame metrics to PostgreSQL
        async with async_session_factory() as db:
            metric_record = CrowdMetric(
                video_id=video_uuid,
                frame_number=metrics["frame_number"],
                timestamp=metrics["timestamp"],
                person_count=metrics["total_persons"],
                detection_confidence_avg=metrics["detection_confidence_avg"],
                density=metrics["metrics"]["density"],
                occupancy=metrics["metrics"]["occupancy"],
                velocity_avg=metrics["metrics"]["velocity_avg"],
                flow_consistency=metrics["metrics"]["flow_consistency"],
                counter_flow_ratio=metrics["metrics"]["counter_flow_ratio"],
                density_growth_rate=metrics["metrics"]["density_growth_rate"],
                speed_drop=metrics["metrics"]["speed_drop"],
                pressure_score=metrics["metrics"]["pressure_score"],
                flow_conflict=metrics["metrics"]["flow_conflict"],
                risk_score=metrics["overall_cri"],
                risk_level=metrics["risk_level"],
            )
            db.add(metric_record)
            await db.commit()

        # Broadcast frame result to Redis pub/sub
        # Include video_id context so the clients can filter messages
        metrics["video_id"] = video_id
        await redis.publish("crowdshield:live_feed", json.dumps(metrics))

    async def on_progress(progress_percent: float):
        # Update progress percentage in database
        async with async_session_factory() as db:
            video = await db.get(Video, video_uuid)
            if video:
                video.processing_progress = progress_percent
                if progress_percent >= 100.0:
                    video.status = "processed"
                    video.processed_at = datetime.utcnow()
                await db.commit()

        # Broadcast progress updates
        await redis.publish("crowdshield:progress", json.dumps({
            "video_id": video_id,
            "progress": progress_percent,
            "status": "processed" if progress_percent >= 100.0 else "processing"
        }))

    # 3. Start processing
    try:
        pipeline = VideoPipeline(processing_fps=processing_fps, device=device)
        summary = await pipeline.process_video(
            video_path=video_path,
            on_frame=on_frame,
            on_progress=on_progress
        )
        return {
            "video_id": video_id,
            "status": "processed",
            "summary": summary
        }
    except Exception as e:
        logger.error(f"Error processing video {video_id}: {e}", exc_info=True)
        async with async_session_factory() as db:
            video = await db.get(Video, video_uuid)
            if video:
                video.status = "failed"
                video.error_message = str(e)
                await db.commit()
        
        await redis.publish("crowdshield:progress", json.dumps({
            "video_id": video_id,
            "status": "failed",
            "error_message": str(e)
        }))
        raise


@celery_app.task(name="app.workers.video_processor.process_video_task")
def process_video_task(video_id: str, settings_dict: dict):
    """Celery task entry point."""
    logger.info(f"Starting background processing for video {video_id}...")
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # Running in a running event loop, schedule coroutine
        future = asyncio.run_coroutine_threadsafe(
            _process_video_async(video_id, settings_dict), loop
        )
        return future.result()
    else:
        return loop.run_until_complete(_process_video_async(video_id, settings_dict))
