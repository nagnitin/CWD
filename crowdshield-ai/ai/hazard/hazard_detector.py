"""
CrowdShield AI — Hazard Detector
Wraps YOLO11 object detections for structural hazards,
with a dynamic simulator to model active scaffolding/barricade movements.
"""

import os
import logging
import random
from ai.config import YOLO_MODEL, YOLO_CONFIDENCE, DEVICE

logger = logging.getLogger("crowdshield.ai.hazard")


class HazardDetector:
    """Detects static and dynamic infrastructure safety hazards in the scene."""

    def __init__(self, model_path: str = None, device: str = DEVICE):
        self.device = device
        self.has_custom_model = False
        
        if model_path and os.path.exists(model_path):
            try:
                # Load specialized fine-tuned YOLO hazard weights
                from ultralytics import YOLO
                self.model = YOLO(model_path)
                self.model.to(device)
                self.has_custom_model = True
                logger.info(f"Loaded custom hazard model from {model_path}")
            except Exception as e:
                logger.warning(f"Could not load custom hazard model: {e}. Falling back to simulation.")
        else:
            logger.info("Custom hazard weights not provided. Running in hazard simulation mode.")

    def detect_hazards(self, frame: object, frame_number: int) -> list:
        """Detect infrastructure objects.

        Args:
            frame: OpenCV image array.
            frame_number: The index of the frame.

        Returns:
            A list of detected hazards: [{'class': str, 'bbox': [x1, y1, x2, y2], 'confidence': float}]
        """
        if self.has_custom_model:
            # Predict scaffolding, barricades, etc.
            # return self.model.predict(...)
            pass

        # Simulation mode: returns a static scaffolding and a dynamic barricade
        # We add small displacements to simulate active movements
        # To simulate a collapse, we make the scaffolding drift downwards/sideways after frame 150
        drift_x = 0.0
        drift_y = 0.0
        if frame_number > 150:
            # Scaffolding starts tilting and collapsing!
            # Exponential drift to model accelerating falling motion
            t = (frame_number - 150) / 10.0
            drift_x = (t ** 2.2) * 1.5
            drift_y = (t ** 2.5) * 2.0

        # Define 2 simulated hazards
        hazards = [
            {
                "id": "hazard_scaffolding_1",
                "class_name": "scaffolding",
                # Bounding box expands and drifts as it collapses
                "bbox": [
                    350.0 + drift_x,
                    200.0 + drift_y,
                    470.0 + drift_x * 1.5,
                    750.0 + drift_y,
                ],
                "confidence": round(0.88 + random.uniform(-0.02, 0.02), 3),
            },
            {
                "id": "hazard_barricade_1",
                "class_name": "barricade",
                # Barricade has slight vibrations but stays static (no progressive drift)
                "bbox": [
                    800.0 + random.uniform(-0.5, 0.5),
                    650.0 + random.uniform(-0.5, 0.5),
                    950.0 + random.uniform(-0.5, 0.5),
                    720.0 + random.uniform(-0.5, 0.5),
                ],
                "confidence": round(0.92 + random.uniform(-0.01, 0.01), 3),
            }
        ]

        return hazards
