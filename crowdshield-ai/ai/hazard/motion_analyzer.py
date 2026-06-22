"""
CrowdShield AI — Hazard Motion Analyzer
Tracks structural displacement history to distinguish static tilts
from active collapses using a temporal state machine.
"""

import math
import logging
from collections import defaultdict

logger = logging.getLogger("crowdshield.ai.hazard")


class MotionAnalyzer:
    """Temporal displacement state machine for structural hazard alerts."""

    def __init__(self, history_len: int = 30):
        self.history_len = history_len
        # Bounding box centers history: {hazard_id: [ (cx, cy, frame_number) ]}
        self.history = defaultdict(list)
        # Active states: {hazard_id: 'STATIC' | 'MONITORING' | 'ALERTING' | 'CRITICAL'}
        self.states = defaultdict(lambda: "STATIC")
        # Accumulated displacements
        self.accumulated_drift = defaultdict(float)

    def analyze_motion(self, hazard_id: str, bbox: list, frame_number: int) -> dict:
        """Update and analyze motion state of a detected hazard.

        Args:
            hazard_id: Unique string identifier of the object.
            bbox: Bounding box coordinates [x1, y1, x2, y2].
            frame_number: The current frame index.

        Returns:
            A dict containing:
                - state: Current motion state.
                - velocity: Velocity in pixels/frame.
                - total_drift: Total Euclidean drift from initial position.
                - trajectory: List of past centers for plotting.
        """
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0

        buffer = self.history[hazard_id]
        buffer.append((cx, cy, frame_number))

        if len(buffer) > self.history_len:
            buffer.pop(0)

        # 1. First frame initialization
        if len(buffer) == 1:
            self.states[hazard_id] = "STATIC"
            self.accumulated_drift[hazard_id] = 0.0
            return {
                "state": "STATIC",
                "velocity": 0.0,
                "total_drift": 0.0,
                "trajectory": [{"x": cx, "y": cy}],
            }

        # 2. Calculate displacements
        initial_cx, initial_cy, _ = buffer[0]
        prev_cx, prev_cy, _ = buffer[-2]

        # Instantaneous velocity (pixels/frame)
        velocity = math.sqrt((cx - prev_cx) ** 2 + (cy - prev_cy) ** 2)
        
        # Total displacement from the initial position
        total_drift = math.sqrt((cx - initial_cx) ** 2 + (cy - initial_cy) ** 2)
        self.accumulated_drift[hazard_id] = total_drift

        # 3. State Machine transitions
        # Determine average velocity over the last 10 frames
        recent_window = buffer[-10:]
        recent_vel = 0.0
        if len(recent_window) > 1:
            rx, ry, _ = recent_window[0]
            recent_vel = math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2) / len(recent_window)

        current_state = self.states[hazard_id]

        if current_state == "STATIC":
            # Start moving?
            if total_drift > 4.0:
                current_state = "MONITORING"
                
        elif current_state == "MONITORING":
            # Accelerating?
            if total_drift > 20.0 and recent_vel > 0.8:
                current_state = "ALERTING"
            elif total_drift < 2.0:
                current_state = "STATIC"
                
        elif current_state == "ALERTING":
            # Collapsing?
            if total_drift > 65.0 or recent_vel > 2.5:
                current_state = "CRITICAL"
            elif total_drift < 10.0:
                current_state = "MONITORING"
                
        elif current_state == "CRITICAL":
            # Can fall back if it stabilizes (e.g. scaffolding lands/stops moving)
            if recent_vel < 0.1 and total_drift > 0:
                # Stabilized in new position
                pass

        self.states[hazard_id] = current_state

        # Map buffer coordinates to trajectory list
        trajectory = [{"x": round(pt[0], 1), "y": round(pt[1], 1)} for pt in buffer]

        return {
            "state": current_state,
            "velocity": round(velocity, 2),
            "total_drift": round(total_drift, 1),
            "trajectory": trajectory,
        }

    def clear(self):
        self.history.clear()
        self.states.clear()
        self.accumulated_drift.clear()
class MotionAnomalyDetector:
    """Detects movement anomalies inside static object bounding boxes."""
    pass
