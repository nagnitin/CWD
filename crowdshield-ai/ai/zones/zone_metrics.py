"""
CrowdShield AI — Zone Metrics Calculator
Computes localized crowd statistics (count, density, speed, consistency, pressure, and risk)
for individual dynamic zones.
"""

import math
import numpy as np
from types import SimpleNamespace


def calculate_zone_metrics(
    zone_id: str,
    bbox: dict,
    detections: list,
    prev_metrics: dict = None,
    dt: float = 0.1,
) -> dict:
    """Compute local metrics for a specific zone.

    Args:
        zone_id: Identifier of the zone.
        bbox: Zone bounding box dict: {x1, y1, x2, y2} in pixels.
        detections: List of detections currently inside this zone.
        prev_metrics: Optional dict of metrics from the previous frame for trend smoothing.
        dt: Time delta in seconds.

    Returns:
        A dict matching the ZoneMetrics schema.
    """
    person_count = len(detections)

    # 1. Estimate physical area in square meters
    # Assume 1920x1080 pixel resolution corresponds to a 60 square meter scene
    total_pixel_area = 1920.0 * 1080.0
    scene_sqm = 60.0
    
    zone_w = bbox["x2"] - bbox["x1"]
    zone_h = bbox["y2"] - bbox["y1"]
    zone_pixel_area = max(1.0, zone_w * zone_h)
    
    # Zone area in square meters
    area_sqm = (zone_pixel_area / total_pixel_area) * scene_sqm
    
    # Calculate density (persons/sqm)
    density = person_count / area_sqm if area_sqm > 0 else 0.0
    occupancy = min(person_count / 20.0, 1.0)  # capacity of 20 per zone

    # 2. Localized movement stats
    avg_velocity = 0.0
    flow_consistency = 1.0
    
    if person_count > 0:
        avg_velocity = sum(d.get("velocity", 0.0) for d in detections) / person_count
        
        if person_count > 1:
            directions = [d.get("direction", 0.0) for d in detections if d.get("velocity", 0.0) > 0.5]
            if len(directions) > 1:
                dir_rads = [np.radians(d) for d in directions]
                sin_avg = np.mean(np.sin(dir_rads))
                cos_avg = np.mean(np.cos(dir_rads))
                flow_consistency = float(np.sqrt(sin_avg**2 + cos_avg**2))

    # 3. Growth rate calculation
    growth_rate = 0.0
    if prev_metrics and "density" in prev_metrics:
        # Change in density per second
        raw_growth = (density - prev_metrics["density"]) / max(0.01, dt)
        # Apply exponential smoothing to prevent extreme spikes
        prev_growth = prev_metrics.get("growth_rate", 0.0)
        growth_rate = 0.8 * prev_growth + 0.2 * raw_growth

    # 4. Pressure calculation
    # Pressure = density * speed_drop * directional_conflict
    normal_speed = 5.0  # free flow speed reference
    speed_drop = max(0.0, (1.0 - (avg_velocity / normal_speed))) if avg_velocity < normal_speed else 0.0
    flow_conflict = 1.0 - flow_consistency
    
    pressure_score = min(100.0, (density ** 1.8) * 15.0 + (speed_drop * 10.0) + (flow_conflict * 20.0))

    # 5. Risk score (localized CRI)
    risk_score = (
        (min(density / 4.0, 1.0) * 100) * 0.20
        + (min(max(0.0, growth_rate) / 2.0, 1.0) * 100) * 0.15
        + (speed_drop * 100) * 0.15
        + pressure_score * 0.20
        + (flow_conflict * 100) * 0.15
        + (occupancy * 100) * 0.15
    )
    
    # Smooth risk score if previous metrics exist
    if prev_metrics and "risk_score" in prev_metrics:
        risk_score = 0.85 * prev_metrics["risk_score"] + 0.15 * risk_score

    risk_score = max(0.0, min(100.0, risk_score))

    # Determine risk level
    if risk_score <= 25.0:
        risk_level = "safe"
    elif risk_score <= 50.0:
        risk_level = "moderate"
    elif risk_score <= 75.0:
        risk_level = "high"
    else:
        risk_level = "critical"

    return {
        "zone_id": zone_id,
        "bbox": bbox,
        "person_count": person_count,
        "density": round(density, 2),
        "occupancy": round(occupancy, 3),
        "velocity_avg": round(avg_velocity, 2),
        "flow_consistency": round(flow_consistency, 3),
        "growth_rate": round(growth_rate, 3),
        "pressure_score": round(pressure_score, 1),
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
    }
