"""
CrowdShield AI — Video Pipeline Orchestrator
Processes a video file frame-by-frame, running it through the AI frame processor,
and triggering callbacks for real-time data storage and broadcasting.
"""

import os
import cv2
import logging
import time
import inspect
from typing import Callable, Optional
from ai.config import DEFAULT_FPS, DEVICE
from ai.pipeline.frame_processor import FrameProcessor

logger = logging.getLogger("crowdshield.ai.pipeline")


class VideoPipeline:
    """Orchestrates video frame reading, downsampling, AI processing, and progress reporting."""

    def __init__(
        self,
        processing_fps: int = DEFAULT_FPS,
        device: str = DEVICE,
    ):
        self.processing_fps = processing_fps
        self.device = device
        self.frame_processor = FrameProcessor(device=device)

    async def process_video(
        self,
        video_path: str,
        on_frame: Callable[[dict], None],
        on_progress: Callable[[float], None],
        should_stop: Optional[Callable[[], bool]] = None,
    ) -> dict:
        """Process an entire video file.

        Args:
            video_path: Absolute path to the video file.
            on_frame: Callback function executed for each processed frame, taking frame metrics dict.
            on_progress: Callback function reporting completion percentage (0.0 to 100.0).
            should_stop: Optional callback to poll for cancellation signals.

        Returns:
            A summary dictionary of the processing run.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise IOError(f"Could not open video file: {video_path}")

        # Extract video properties
        src_fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / src_fps

        logger.info(
            f"Starting video processing. FPS={src_fps:.2f}, Frames={total_frames}, "
            f"Res={width}x{height}, Duration={duration:.2f}s"
        )

        # Calculate frame skip logic to match target processing_fps
        frame_interval = max(1, int(round(src_fps / self.processing_fps)))
        
        frame_count = 0
        processed_count = 0
        start_time = time.time()

        try:
            while cap.isOpened():
                if should_stop and should_stop():
                    logger.info("Video processing job cancelled by user request.")
                    break

                ret, frame = cap.read()
                if not ret:
                    break

                # Process every Nth frame based on target processing FPS
                if frame_count % frame_interval == 0:
                    timestamp = frame_count / src_fps
                    
                    # Run frame processing (YOLO + tracking + metrics)
                    metrics = self.frame_processor.process(
                        frame=frame,
                        frame_number=frame_count,
                        timestamp=timestamp,
                    )
                    
                    # Inject video dimension context into the metrics
                    metrics["width"] = width
                    metrics["height"] = height
                    metrics["processing_fps"] = self.processing_fps

                    # Trigger per-frame callback (e.g. database save & WebSocket publish)
                    if hasattr(on_frame, "__code__") and on_frame.__code__.co_flags & 0x80:  # Check if coroutine
                        await on_frame(metrics)
                    else:
                        if inspect.iscoroutinefunction(on_frame):
                            await on_frame(metrics)
                        else:
                            on_frame(metrics)
                    processed_count += 1

                # Calculate progress based on frame index
                progress = min(100.0, (frame_count / total_frames) * 100.0)
                if inspect.iscoroutinefunction(on_progress):
                    await on_progress(round(progress, 1))
                else:
                    on_progress(round(progress, 1))

                frame_count += 1

            # Final progress update
            if inspect.iscoroutinefunction(on_progress):
                await on_progress(100.0)
            else:
                on_progress(100.0)

        finally:
            cap.release()

        elapsed_time = time.time() - start_time
        processing_fps_achieved = processed_count / elapsed_time if elapsed_time > 0 else 0

        summary = {
            "total_frames": total_frames,
            "processed_frames": processed_count,
            "duration": round(duration, 2),
            "elapsed_time": round(elapsed_time, 2),
            "fps_achieved": round(processing_fps_achieved, 2),
            "width": width,
            "height": height,
        }
        logger.info(f"Video processing finished: {summary}")
        return summary
