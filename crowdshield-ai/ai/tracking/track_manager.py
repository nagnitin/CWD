"""
CrowdShield AI — Track Lifecycle Manager
Manages active tracks, calculates velocities, direction angles, and maintains trajectory history.
"""

import math
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger("crowdshield.ai.tracking")


class TrackManager:
    """Manages active tracking states across successive frames."""

    def __init__(self, max_age: int = 30, max_history: int = 15):
        """
        Args:
            max_age: Maximum number of frames to keep a track active without updates.
            max_history: Maximum trajectory points to keep for rendering trails.
        """
        self.max_age = max_age
        self.max_history = max_history
        self.tracks: Dict[int, dict] = {}
        self.current_frame = 0

    def update(self, detected_tracks: List[dict], frame_number: int) -> List[dict]:
        """Update active tracks with new frame detections.

        Args:
            detected_tracks: List of track dicts from ByteTrackTracker.
            frame_number: The current frame sequence number.

        Returns:
            A list of updated tracks with computed velocity, direction, and trajectories.
        """
        self.current_frame = frame_number
        updated_track_ids = set()

        for det in detected_tracks:
            track_id = det.get("track_id")
            if track_id is None:
                continue

            bbox = det["bbox"]  # [x1, y1, x2, y2]
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0

            updated_track_ids.add(track_id)

            if track_id not in self.tracks:
                # New track initialization
                self.tracks[track_id] = {
                    "track_id": track_id,
                    "bbox": {"x1": bbox[0], "y1": bbox[1], "x2": bbox[2], "y2": bbox[3]},
                    "velocity": 0.0,
                    "direction": 0.0,
                    "duration_frames": 1,
                    "trajectory": [{"x": round(cx, 1), "y": round(cy, 1), "frame": frame_number}],
                    "last_seen_frame": frame_number,
                }
            else:
                # Existing track update
                track = self.tracks[track_id]
                prev_trajectory = track["trajectory"]
                prev_cx, prev_cy = prev_trajectory[-1]["x"], prev_trajectory[-1]["y"]

                # Calculate velocity & direction
                dx = cx - prev_cx
                dy = cy - prev_cy
                velocity = math.sqrt(dx * dx + dy * dy)
                
                # Direction in degrees: 0 is right, 90 is down, 180 is left, 270 is up
                if velocity > 0.5:  # filter noise
                    direction = math.degrees(math.atan2(dy, dx)) % 360
                else:
                    direction = track.get("direction", 0.0)

                # Update trajectory history
                trajectory = prev_trajectory + [{"x": round(cx, 1), "y": round(cy, 1), "frame": frame_number}]
                if len(trajectory) > self.max_history:
                    trajectory = trajectory[-self.max_history:]

                # Update track dictionary
                track["bbox"] = {"x1": bbox[0], "y1": bbox[1], "x2": bbox[2], "y2": bbox[3]}
                track["velocity"] = round(velocity, 2)
                track["direction"] = round(direction, 1)
                track["duration_frames"] += 1
                track["trajectory"] = trajectory
                track["last_seen_frame"] = frame_number

        # Clean up stale tracks
        stale_ids = []
        for tid, track in self.tracks.items():
            if frame_number - track["last_seen_frame"] > self.max_age:
                stale_ids.append(tid)
        
        for tid in stale_ids:
            del self.tracks[tid]

        # Return list of currently active tracks that were updated in this frame
        result = []
        for det in detected_tracks:
            tid = det.get("track_id")
            if tid in self.tracks:
                track = self.tracks[tid]
                result.append({
                    "bbox": track["bbox"],
                    "confidence": det["confidence"],
                    "track_id": tid,
                    "velocity": track["velocity"],
                    "direction": track["direction"],
                    "duration_frames": track["duration_frames"],
                    "trajectory": track["trajectory"]
                })
        return result
