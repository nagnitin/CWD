"""
CrowdShield AI — Forecast Engine
Buffers historical zone metrics, constructs spatial graphs, and projects crowd states
at +1m, +3m, and +5m horizons using regression trend analysis fallbacks.
"""

import logging
from collections import defaultdict
from ai.forecasting.graph_builder import GraphBuilder

logger = logging.getLogger("crowdshield.ai.forecasting")


class Forecaster:
    """Buffers past zone metrics and projects future crowd density, pressure, and risk."""

    def __init__(self, history_length: int = 12, dt: float = 2.5):
        """
        Args:
            history_length: Number of time steps to buffer in history (e.g., last 12 snapshots).
            dt: Time difference in seconds between snapshots (e.g. sampling every 2.5 seconds).
        """
        self.history_length = history_length
        self.dt = dt
        self.graph_builder = GraphBuilder()
        # Buffer of past zone metrics: {zone_id: [ {density, pressure, risk_score, timestamp} ]}
        self.zone_buffers = defaultdict(list)

    def update_history(self, zones: list, timestamp: float):
        """Buffer current zone metrics into rolling queue."""
        for zone in zones:
            zone_id = zone["zone_id"]
            
            # Record current metrics
            record = {
                "density": zone["density"],
                "pressure_score": zone["pressure_score"],
                "risk_score": zone["risk_score"],
                "timestamp": timestamp,
            }
            
            self.zone_buffers[zone_id].append(record)
            
            # Maintain rolling window size
            if len(self.zone_buffers[zone_id]) > self.history_length:
                self.zone_buffers[zone_id].pop(0)

    def forecast(self, current_zones: list) -> dict:
        """Forecast zone metrics for +1m, +3m, and +5m horizons.

        Args:
            current_zones: List of active zones from FrameProcessor.

        Returns:
            A dictionary containing predicted zones for each horizon.
        """
        if not current_zones:
            return {"+1m": [], "+3m": [], "+5m": []}

        # Build adjacency matrix and Laplacian from current zone layout
        adj, laplacian = self.graph_builder.build_graph(current_zones)

        horizons = {
            "+1m": 60.0,   # 1 minute forecast (60 seconds)
            "+3m": 180.0,  # 3 minutes forecast (180 seconds)
            "+5m": 300.0,  # 5 minutes forecast (300 seconds)
        }

        predictions = {}

        # Run forecasting for each target horizon
        for name, seconds in horizons.items():
            predicted_zones = []
            
            for zone in current_zones:
                zone_id = zone["zone_id"]
                bbox = zone["bbox"]
                history = self.zone_buffers[zone_id]

                # Default values (constant projection)
                pred_density = zone["density"]
                pred_pressure = zone["pressure_score"]
                pred_risk = zone["risk_score"]

                # If we have enough history, compute linear trends to extrapolate
                if len(history) >= 4:
                    # Time steps array
                    t = [h["timestamp"] for h in history]
                    # Normalize time to start at 0
                    t_norm = [x - t[0] for x in t]

                    # Extrapolate Density
                    densities = [h["density"] for h in history]
                    slope_d, _ = np_linear_fit(t_norm, densities)
                    pred_density = max(0.0, zone["density"] + slope_d * seconds)

                    # Extrapolate Pressure
                    pressures = [h["pressure_score"] for h in history]
                    slope_p, _ = np_linear_fit(t_norm, pressures)
                    pred_pressure = max(0.0, min(100.0, zone["pressure_score"] + slope_p * seconds))

                    # Extrapolate Risk
                    risks = [h["risk_score"] for h in history]
                    slope_r, _ = np_linear_fit(t_norm, risks)
                    pred_risk = max(0.0, min(100.0, zone["risk_score"] + slope_r * seconds))

                # Smooth risk boundaries
                if pred_risk <= 25.0:
                    risk_level = "safe"
                elif pred_risk <= 50.0:
                    risk_level = "moderate"
                elif pred_risk <= 75.0:
                    risk_level = "high"
                else:
                    risk_level = "critical"

                predicted_zones.append({
                    "zone_id": zone_id,
                    "bbox": bbox,
                    "density": round(pred_density, 2),
                    "pressure_score": round(pred_pressure, 1),
                    "risk_score": round(pred_risk, 1),
                    "risk_level": risk_level,
                })
                
            predictions[name] = predicted_zones

        return predictions


def np_linear_fit(x: list[float], y: list[float]) -> tuple[float, float]:
    """Helper to calculate simple linear regression slope and intercept."""
    n = len(x)
    if n == 0:
        return 0.0, 0.0
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xx = sum(val * val for val in x)
    sum_xy = sum(val_x * val_y for val_x, val_y in zip(x, y))

    denominator = (n * sum_xx - sum_x * sum_x)
    if denominator == 0:
        return 0.0, y[-1]

    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept
