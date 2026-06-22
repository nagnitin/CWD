"""
CrowdShield AI — Alert Engine
Aggregates crowd dynamics telemetry, forecasting, and infrastructure hazards
to generate false-alarm-filtered emergency alerts.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from ai.alerts.false_alarm_filter import FalseAlarmFilter
from ai.alerts.response_engine import ResponseEngine

logger = logging.getLogger("crowdshield.ai.alerts")


class AlertEngine:
    """Core alert processing engine integrating FalseAlarmFilter and ResponseEngine."""

    def __init__(self, min_frames: int = 5, min_seconds: float = 3.0):
        self.filter = FalseAlarmFilter(min_frames=min_frames, min_seconds=min_seconds)
        self.response_engine = ResponseEngine()
        
        # Persistent alert metadata: {event_key: {id, created_at, reason, etc.}}
        self.alert_metadata = {}

    def process(
        self,
        frame_data: Dict[str, Any],
        hazards: List[Dict[str, Any]],
        timestamp: float,
        video_id: Optional[uuid.UUID] = None,
        camera_id: Optional[uuid.UUID] = None
    ) -> List[Dict[str, Any]]:
        """Evaluate crowd metrics and hazards, filter false alarms, and generate active alerts.

        Args:
            frame_data: The processed frame data dict (CRI, zones, forecasts, etc.).
            hazards: List of detected hazards with their current analyzed motion states.
            timestamp: Time offset of the frame in seconds from video start.
            video_id: Optional UUID of the video source.
            camera_id: Optional UUID of the camera source.

        Returns:
            A list of active, validated alert dictionaries conforming to the schema.
        """
        # Dictionary of current frame trigger candidates: {event_key: dict_of_trigger_info}
        triggers = {}

        # 1. Global CRI Triggers
        cri = frame_data.get("overall_cri", 0.0)
        
        # Critical stampede risk
        triggers["cri_critical"] = {
            "is_triggered": cri >= 80.0,
            "confidence": cri / 100.0,
            "level": "critical",
            "alert_type": "stampede_risk",
            "zone": "Global",
            "reason": f"Critical crowd stampede risk! Overall Crowd Risk Index (CRI) has reached {cri:.1f}%.",
            "prediction_horizon": "now",
        }
        
        # High pressure warning
        triggers["cri_high"] = {
            "is_triggered": cri >= 60.0 and cri < 80.0,
            "confidence": cri / 100.0,
            "level": "high",
            "alert_type": "crowd_pressure",
            "zone": "Global",
            "reason": f"High crowd risk index detected (CRI: {cri:.1f}%). Monitor bottlenecks closely.",
            "prediction_horizon": "now",
        }
        
        # Moderate build-up warning
        triggers["cri_warning"] = {
            "is_triggered": cri >= 40.0 and cri < 60.0,
            "confidence": cri / 100.0,
            "level": "warning",
            "alert_type": "crowd_density",
            "zone": "Global",
            "reason": f"Moderate crowd build-up detected in scene (CRI: {cri:.1f}%).",
            "prediction_horizon": "now",
        }

        # 2. Local Zone Bottlenecks
        zones = frame_data.get("zones", [])
        for zone in zones:
            zone_id = zone.get("zone_id", "Unknown")
            density = zone.get("density", 0.0)
            pressure = zone.get("pressure_score", 0.0)
            
            # Critical local pressure/crush risk
            triggers[f"zone_{zone_id}_critical_pressure"] = {
                "is_triggered": pressure >= 35.0,
                "confidence": min(1.0, pressure / 50.0),
                "level": "critical",
                "alert_type": "crowd_pressure",
                "zone": zone_id,
                "reason": f"Extreme local pressure ({pressure:.1f}) in {zone_id}. High risk of crowd crush.",
                "prediction_horizon": "now",
            }
            
            # High density bottleneck
            triggers[f"zone_{zone_id}_bottleneck"] = {
                "is_triggered": density >= 3.5 and pressure < 35.0,
                "confidence": min(1.0, density / 5.0),
                "level": "high",
                "alert_type": "bottleneck",
                "zone": zone_id,
                "reason": f"Local bottleneck in {zone_id} with density of {density:.1f} people/sqm.",
                "prediction_horizon": "now",
            }

        # 3. Forecasted Bottleneck Warnings
        forecasts = frame_data.get("forecasts", {})
        for horizon in ["+1m", "+3m", "+5m"]:
            fc_data = forecasts.get(horizon, {})
            fc_zones = fc_data.get("zones", [])
            for f_zone in fc_zones:
                zone_id = f_zone.get("zone_id", "Unknown")
                pred_density = f_zone.get("density", 0.0)
                
                triggers[f"forecast_{horizon}_{zone_id}_bottleneck"] = {
                    "is_triggered": pred_density >= 4.0,
                    "confidence": min(1.0, pred_density / 6.0),
                    "level": "warning",
                    "alert_type": "forecast_warning",
                    "zone": zone_id,
                    "reason": f"Predictive Bottleneck: Density in {zone_id} is forecast to reach {pred_density:.1f}/sqm in {horizon}.",
                    "prediction_horizon": horizon,
                }

        # 4. Infrastructure Hazard Triggers
        for hazard in hazards:
            hazard_id = hazard.get("id", "Unknown")
            class_name = hazard.get("class_name", "structure")
            state = hazard.get("motion_state", "static").upper()
            confidence = hazard.get("confidence", 1.0)
            vel = hazard.get("motion_velocity", 0.0)
            
            triggers[f"hazard_{hazard_id}_critical"] = {
                "is_triggered": state == "CRITICAL",
                "confidence": confidence,
                "level": "critical",
                "alert_type": "hazard_movement",
                "zone": "Infrastructure",
                "reason": f"CRITICAL COLLAPSE DANGER: {class_name} ({hazard_id}) is actively falling (velocity: {vel:.2f}px/frame)!",
                "prediction_horizon": "now",
                "extra_data": {"class_name": class_name}
            }
            
            triggers[f"hazard_{hazard_id}_warning"] = {
                "is_triggered": state == "ALERTING",
                "confidence": confidence,
                "level": "high",
                "alert_type": "hazard_movement",
                "zone": "Infrastructure",
                "reason": f"Warning: Structural movement detected in {class_name} ({hazard_id}) (velocity: {vel:.2f}px/frame).",
                "prediction_horizon": "now",
                "extra_data": {"class_name": class_name}
            }

        # 5. Feed Triggers into FalseAlarmFilter
        active_alerts = []
        
        # We need to process all potential triggers to update/release states
        all_keys = set(triggers.keys()).union(self.alert_metadata.keys())
        
        for event_key in all_keys:
            trigger_info = triggers.get(event_key)
            is_triggered = trigger_info.get("is_triggered", False) if trigger_info else False
            conf = trigger_info.get("confidence", 0.0) if trigger_info else 0.0
            
            # Run FalseAlarmFilter validation
            # Returns True if alert is NEWLY confirmed, False otherwise
            self.filter.validate_event(
                event_key=event_key,
                is_triggered=is_triggered,
                confidence=conf,
                current_time=timestamp
            )

            # Check if alert is active (new or continuing)
            if self.filter.check_active(event_key):
                # If newly confirmed, we initialize metadata
                if event_key not in self.alert_metadata:
                    info = trigger_info or {}
                    extra = info.get("extra_data", {})
                    
                    # Generate action using ResponseEngine
                    rec_action = self.response_engine.generate_recommendation(
                        level=info.get("level", "info"),
                        alert_type=info.get("alert_type", "monitor"),
                        zone=info.get("zone"),
                        extra_data=extra
                    )
                    
                    # Get confirmation frame count and duration
                    pending_state = self.filter.pending_events.get(event_key, {})
                    conf_frames = pending_state.get("consecutive_count", 0)
                    first_seen = pending_state.get("first_seen_time", timestamp)
                    duration = timestamp - first_seen
                    
                    mean_conf = 1.0
                    if conf_frames > 0:
                        mean_conf = pending_state.get("confidence_accumulator", 0.0) / conf_frames

                    self.alert_metadata[event_key] = {
                        "id": uuid.uuid4(),
                        "video_id": video_id,
                        "camera_id": camera_id,
                        "level": info.get("level", "info"),
                        "alert_type": info.get("alert_type", "monitor"),
                        "zone": info.get("zone"),
                        "reason": info.get("reason", "No reason provided."),
                        "confidence": round(info.get("confidence", 0.0), 3),
                        "prediction_horizon": info.get("prediction_horizon", "now"),
                        "recommended_action": rec_action,
                        "confirmation_frames": conf_frames,
                        "persistence_seconds": round(duration, 2),
                        "fused_confidence": round(mean_conf, 3),
                        "acknowledged": False,
                        "resolved": False,
                        "is_false_alarm": False,
                        "created_at": datetime.now(timezone.utc),
                    }
                else:
                    # Update persistence metrics for active alert
                    pending_state = self.filter.pending_events.get(event_key, {})
                    first_seen = pending_state.get("first_seen_time", timestamp)
                    duration = timestamp - first_seen
                    
                    self.alert_metadata[event_key]["persistence_seconds"] = round(duration, 2)
                
                active_alerts.append(self.alert_metadata[event_key])
            else:
                # If not active, clean up cached metadata if it existed
                if event_key in self.alert_metadata:
                    del self.alert_metadata[event_key]

        return active_alerts

    def clear(self):
        """Reset running state."""
        self.filter.clear()
        self.alert_metadata.clear()
