"""
CrowdShield AI — ByteTrack Integration
Wrapper around YOLO11's native tracking capabilities using ByteTrack.
"""

import logging
import numpy as np
from ultralytics import YOLO
from ai.config import YOLO_MODEL, YOLO_CONFIDENCE, YOLO_IOU_THRESHOLD, DEVICE

logger = logging.getLogger("crowdshield.ai.tracking")


class ByteTrackTracker:
    """ByteTrack wrapper leveraging YOLO11's built-in tracking capabilities."""

    def __init__(
        self,
        model_name: str = YOLO_MODEL,
        confidence: float = YOLO_CONFIDENCE,
        iou: float = YOLO_IOU_THRESHOLD,
        device: str = DEVICE,
    ):
        self.model_name = model_name
        self.confidence = confidence
        self.iou = iou
        self.device = device
        
        logger.info(f"Loading YOLO tracking model '{model_name}' on device '{device}'...")
        try:
            self.model = YOLO(model_name)
            self.model.to(device)
            self.has_model = True
            logger.info("YOLO tracking model loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load YOLO tracking model: {e}. Falling back to tracking simulation.")
            self.model = None
            self.has_model = False

    def track(self, frame: np.ndarray, persist: bool = True) -> list[dict]:
        """Detect and track people in a single frame.

        Args:
            frame: OpenCV image array (BGR format).
            persist: Whether to maintain tracking history from previous frames.

        Returns:
            A list of tracked objects. Each object is a dict with:
                - bbox: [x1, y1, x2, y2]
                - confidence: float
                - class_id: int
                - track_id: int | None (track ID assigned by ByteTrack)
        """
        if frame is None:
            return []

        if not self.has_model:
            # Simulated tracking: return 2 mock tracks
            return [
                {
                    "bbox": [100.0, 100.0, 150.0, 200.0],
                    "confidence": 0.92,
                    "class_id": 0,
                    "track_id": 1,
                },
                {
                    "bbox": [300.0, 150.0, 350.0, 250.0],
                    "confidence": 0.88,
                    "class_id": 0,
                    "track_id": 2,
                }
            ]

        # Run tracking using ByteTrack config
        results = self.model.track(
            source=frame,
            classes=[0],  # Person only
            conf=self.confidence,
            iou=self.iou,
            device=self.device,
            persist=persist,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        tracks = []
        if not results or results[0].boxes is None:
            return tracks

        boxes = results[0].boxes
        for box in boxes:
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0].item())
            cls_id = int(box.cls[0].item())
            
            # Extract track ID if available
            track_id = None
            if box.is_track:
                track_id = int(box.id[0].item())

            tracks.append({
                "bbox": [round(coord, 1) for coord in xyxy],
                "confidence": round(conf, 4),
                "class_id": cls_id,
                "track_id": track_id,
            })

        return tracks
