"""
CrowdShield AI — Crowd Risk Index (CRI) Calculator
Aggregates crowd dynamics factors (density, flow, speed, pressure, occupancy)
and applies exponential moving average smoothing.
"""

import logging

logger = logging.getLogger("crowdshield.ai.pressure")


class CRICalculator:
    """Calculates overall Crowd Risk Index (CRI) with exponential smoothing."""

    def __init__(self, smoothing_factor: float = 0.15):
        """
        Args:
            smoothing_factor: Alpha parameter for EMA smoothing (0.0 to 1.0).
                              Lower values filter more noise but increase latency.
        """
        self.alpha = smoothing_factor
        self.prev_cri = None

    def calculate_cri(
        self,
        density: float,
        growth_rate: float,
        speed_drop: float,
        pressure: float,
        flow_conflict: float,
        occupancy: float,
    ) -> float:
        """Compute the multi-factor Crowd Risk Index.

        Args:
            density: Persons per square meter.
            growth_rate: Change in density per second.
            speed_drop: Normalized speed drop ratio (0.0 to 1.0).
            pressure: Estimated crowd pressure (0 to 100).
            flow_conflict: Directional conflict ratio (0.0 to 1.0).
            occupancy: Local space utilization ratio (0.0 to 1.0).

        Returns:
            A smoothed Crowd Risk Index score from 0.0 to 100.0.
        """
        # Normalize individual components to 0-100 scale
        density_norm = min(density / 4.0, 1.0) * 100.0
        growth_norm = min(max(0.0, growth_rate) / 2.0, 1.0) * 100.0
        speed_norm = speed_drop * 100.0
        conflict_norm = flow_conflict * 100.0
        occupancy_norm = occupancy * 100.0

        # Weighted aggregate formula
        raw_cri = (
            density_norm * 0.20
            + growth_norm * 0.15
            + speed_norm * 0.15
            + pressure * 0.20
            + conflict_norm * 0.15
            + occupancy_norm * 0.15
        )

        raw_cri = max(0.0, min(100.0, raw_cri))

        # Apply exponential moving average (EMA) smoothing
        if self.prev_cri is None:
            self.prev_cri = raw_cri
        else:
            self.prev_cri = self.alpha * raw_cri + (1.0 - self.alpha) * self.prev_cri

        return float(self.prev_cri)

    def get_risk_level(self, cri: float) -> str:
        """Categorize CRI score into a text risk level."""
        if cri <= 25.0:
            return "safe"
        elif cri <= 50.0:
            return "moderate"
        elif cri <= 75.0:
            return "high"
        else:
            return "critical"

    def reset(self):
        """Reset historical running state."""
        self.prev_cri = None
