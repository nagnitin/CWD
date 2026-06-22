"""Forecast schemas — prediction results at multiple horizons."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ForecastResponse(BaseModel):
    id: uuid.UUID
    zone_id: str
    horizon_minutes: int
    model_name: str
    predicted_density: float
    predicted_count: int
    predicted_risk: float
    predicted_pressure: float
    predicted_velocity: float
    predicted_risk_level: str
    is_bottleneck: bool
    is_congestion: bool
    confidence: float
    uncertainty: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ForecastSet(BaseModel):
    """All forecast horizons for a given frame."""
    frame_number: int
    timestamp: float
    forecasts_1m: list[ForecastResponse]
    forecasts_3m: list[ForecastResponse]
    forecasts_5m: list[ForecastResponse]


class PredictiveHeatmapResponse(BaseModel):
    frame_number: int
    heatmap_current: Optional[str] = None  # base64 encoded PNG
    heatmap_1m: Optional[str] = None
    heatmap_3m: Optional[str] = None
    heatmap_5m: Optional[str] = None
