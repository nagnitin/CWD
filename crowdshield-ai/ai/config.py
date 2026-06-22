"""
CrowdShield AI — AI Engine Configuration
Central settings and helper functions for AI models and devices.
"""

import os
import torch

# ─── Detection Settings ───────────────────────────────────────
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolo11n.pt")
YOLO_CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.35"))
YOLO_IOU_THRESHOLD = float(os.getenv("YOLO_IOU_THRESHOLD", "0.45"))
DEFAULT_FPS = int(os.getenv("DEFAULT_PROCESSING_FPS", "10"))

# ─── Device Auto-Detection ────────────────────────────────────
def get_device() -> str:
    """Detect and return the best available compute device."""
    env_device = os.getenv("DEVICE", "auto").lower()
    if env_device != "auto":
        return env_device
        
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        # Apple Silicon GPU acceleration
        return "mps"
    return "cpu"

DEVICE = get_device()
