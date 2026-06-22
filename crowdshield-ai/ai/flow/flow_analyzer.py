"""
CrowdShield AI — Optical Flow Analyzer
Analyzes dense optical flow fields to compute speed, direction, flow consistency,
and aggregates vectors on a grid for SVG arrow overlay representation.
"""

import math
import numpy as np


class FlowAnalyzer:
    """Computes global motion statistics and formats grid vectors for visualization."""

    def __init__(self, magnitude_threshold: float = 0.5, grid_step: int = 20):
        """
        Args:
            magnitude_threshold: Minimum speed to consider as active movement.
            grid_step: Pixel spacing for grid-sampled visualization vectors.
        """
        self.magnitude_threshold = magnitude_threshold
        self.grid_step = grid_step

    def analyze(self, flow: np.ndarray, original_shape: tuple) -> dict:
        """Analyze a dense optical flow field.

        Args:
            flow: Dense flow array of shape (H, W, 2) from OpticalFlowCalculator.
            original_shape: (height, width) of the original unresized frame.

        Returns:
            A dict containing:
                - velocity_avg: Mean magnitude of all active vectors.
                - flow_consistency: Normalized direction alignment (0.0 to 1.0).
                - flow_direction: Global weighted angle in degrees.
                - arrows: List of sampled vectors for SVG overlays.
        """
        if flow is None:
            return {
                "velocity_avg": 0.0,
                "flow_consistency": 1.0,
                "flow_direction": 0.0,
                "arrows": [],
            }

        h, w = flow.shape[:2]
        orig_h, orig_w = original_shape[:2]
        
        u = flow[..., 0]
        v = flow[..., 1]

        # Calculate magnitudes and angles for every pixel
        magnitudes = np.sqrt(u * u + v * v)
        angles = np.arctan2(v, u)  # radians

        # Filter out noise (pixels with tiny movements)
        active_mask = magnitudes > self.magnitude_threshold
        active_mags = magnitudes[active_mask]
        active_angles = angles[active_mask]

        # Calculate global averages
        if active_mags.size > 0:
            velocity_avg = float(np.mean(active_mags))
            
            # Global flow direction (weighted average of angles by speed magnitude)
            sin_sum = np.sum(np.sin(active_angles) * active_mags)
            cos_sum = np.sum(np.cos(active_angles) * active_mags)
            global_angle_rad = np.arctan2(sin_sum, cos_sum)
            flow_direction = float(np.degrees(global_angle_rad) % 360)

            # Flow consistency (mean resultant length of unit vectors)
            sin_avg = np.mean(np.sin(active_angles))
            cos_avg = np.mean(np.cos(active_angles))
            flow_consistency = float(np.sqrt(sin_avg * sin_avg + cos_avg * cos_avg))
        else:
            velocity_avg = 0.0
            flow_direction = 0.0
            flow_consistency = 1.0

        # Grid sampling for lightweight frontend overlays
        arrows = []
        scale_x = orig_w / w
        scale_y = orig_h / h

        # Loop over grid cells
        for y in range(self.grid_step // 2, h, self.grid_step):
            for x in range(self.grid_step // 2, w, self.grid_step):
                # Calculate local cell window slice
                y_start = max(0, y - self.grid_step // 2)
                y_end = min(h, y + self.grid_step // 2)
                x_start = max(0, x - self.grid_step // 2)
                x_end = min(w, x + self.grid_step // 2)

                # Get average displacement vector in cell
                cell_u = np.mean(u[y_start:y_end, x_start:x_end])
                cell_v = np.mean(v[y_start:y_end, x_start:x_end])
                cell_mag = math.sqrt(cell_u * cell_u + cell_v * cell_v)

                # Add arrow if cell speed exceeds threshold
                if cell_mag > self.magnitude_threshold * 1.5:
                    cell_angle = math.degrees(math.atan2(cell_v, cell_u)) % 360
                    
                    # Store coordinates scaled back to original frame dimensions
                    arrows.append({
                        "x": round(x * scale_x, 1),
                        "y": round(y * scale_y, 1),
                        "dx": round(cell_u * scale_x, 1),
                        "dy": round(cell_v * scale_y, 1),
                        "magnitude": round(cell_mag, 2),
                        "angle": round(cell_angle, 1),
                    })

        return {
            "velocity_avg": round(velocity_avg, 2),
            "flow_consistency": round(flow_consistency, 3),
            "flow_direction": round(flow_direction, 1),
            "arrows": arrows,
        }
