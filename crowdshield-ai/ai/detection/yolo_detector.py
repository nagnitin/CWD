"""
CrowdShield AI — YOLO11 Person Detector
Wrapper for the Ultralytics YOLO11 model to detect people in input frames.
"""

import logging
import numpy as np
from ultralytics import YOLO
from ai.config import YOLO_MODEL, YOLO_CONFIDENCE, YOLO_IOU_THRESHOLD, DEVICE

logger = logging.getLogger("crowdshield.ai.detection")


class YoloDetector:
    """Wrapper class for YOLO11 object detection model filtered for person class."""

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
        
        logger.info(f"Loading YOLO model '{model_name}' on device '{device}'...")
        try:
            self.model = YOLO(model_name)
            # Move model to device explicitly if needed
            self.model.to(device)
            logger.info("YOLO model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Detect people in a single frame.

        Args:
            frame: OpenCV image array (BGR format).

        Returns:
            A list of detections. Each detection is a dict with:
                - bbox: [x1, y1, x2, y2] (coordinates in pixels)
                - confidence: float (0.0 to 1.0)
                - class_id: int (always 0 for person)
        """
        if frame is None:
            return []

        # Run inference
        # Class 0 is 'person' in Common Objects in Context (COCO) dataset
        results = self.model.predict(
            source=frame,
            classes=[0],
            conf=self.confidence,
            iou=self.iou,
            device=self.device,
            verbose=False,
        )

        detections = []
        if not results:
            return detections

        boxes = results[0].boxes
        for box in boxes:
            # Get box coordinates as [x1, y1, x2, y2]
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0].item())
            cls_id = int(box.cls[0].item())

            detections.append({
                "bbox": [round(coord, 1) for coord in xyxy],
                "confidence": round(conf, 4),
                "class_id": cls_id,
            })

        return detections
