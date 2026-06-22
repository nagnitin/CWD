"""
CrowdShield AI — Crowd Pressure Estimator
Calculates global and localized crowd pressure scores (0-100) based on
local density, velocity reductions, and directional conflicts.
"""

import logging

logger = logging.getLogger("crowdshield.ai.pressure")


class PressureEstimator:
    """Calculates non-linear crowd pressure indicators to predict crush/stampede hazards."""

    def __init__(self, density_exponent: float = 1.8, scaling_factor: float = 15.0):
        self.density_exponent = density_exponent
        self.scaling_factor = scaling_factor

    def compute_pressure(
        self,
        density: float,
        avg_velocity: float,
        normal_velocity: float = 5.0,
        flow_consistency: float = 1.0,
    ) -> float:
        """Calculate crowd pressure score.

        Args:
            density: Local crowd density (persons / sqm).
            avg_velocity: Average speed of people (pixels/frame).
            normal_velocity: Speed of free-flowing crowd under normal density.
            flow_consistency: Ratio of directional alignment (0.0 to 1.0).

        Returns:
            A crowd pressure index score from 0.0 (safe) to 100.0 (extreme risk).
        """
        # Speed reduction ratio (0.0 to 1.0)
        speed_drop = 0.0
        if avg_velocity < normal_velocity:
            speed_drop = 1.0 - (avg_velocity / normal_velocity)

        # Directional conflict ratio (0.0 to 1.0)
        flow_conflict = 1.0 - flow_consistency

        # Pressure score modeled as non-linear density scaling + speed drops + conflicts
        # High density combined with a sharp speed drop indicates crush build-up
        pressure = (
            (density ** self.density_exponent) * self.scaling_factor
            + (speed_drop * 10.0)
            + (flow_conflict * 20.0)
        )

        return float(max(0.0, min(100.0, pressure)))
