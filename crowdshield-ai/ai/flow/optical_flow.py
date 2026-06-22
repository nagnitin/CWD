"""
CrowdShield AI — Optical Flow Calculator
Computes dense optical flow vectors using OpenCV's Farneback algorithm
on downsampled frames for optimized real-time speed.
"""

import cv2
import logging
import numpy as np

logger = logging.getLogger("crowdshield.ai.flow")


class OpticalFlowCalculator:
    """Computes dense optical flow to capture pixel-level speed and direction vectors."""

    def __init__(self, downsample_width: int = 320, downsample_height: int = 180):
        self.width = downsample_width
        self.height = downsample_height
        self.prev_gray = None

    def compute_flow(self, frame: np.ndarray) -> np.ndarray | None:
        """Compute optical flow vectors (u, v) between successive frames.

        Args:
            frame: OpenCV image array (BGR format).

        Returns:
            A 2D array of shape (height, width, 2) containing velocity vectors (dx, dy),
            or None if this is the first frame.
        """
        if frame is None:
            return None

        # 1. Downsample for performance (essential for CPU execution)
        resized = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_AREA)

        # 2. Convert to grayscale
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        # 3. Handle first frame initialization
        if self.prev_gray is None:
            self.prev_gray = gray
            return None

        # 4. Calculate Farneback dense optical flow
        # parameters: prev, next, flow, pyr_scale, levels, winsize, iterations, poly_n, poly_sigma, flags
        flow = cv2.calcOpticalFlowFarneback(
            self.prev_gray,
            gray,
            None,
            0.5,
            3,
            15,
            3,
            5,
            1.2,
            0,
        )

        # Update previous frame
        self.prev_gray = gray

        return flow

    def reset(self):
        """Reset the frame history buffer (useful when changing video sources)."""
        self.prev_gray = None
