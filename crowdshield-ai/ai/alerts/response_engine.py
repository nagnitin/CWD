"""
CrowdShield AI — Emergency Response Recommendation Engine
Generates context-aware, prioritized emergency action recommendations
based on safety alerts and infrastructure hazard states.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("crowdshield.ai.alerts")


class ResponseEngine:
    """Generates context-aware recommended emergency actions for active alerts."""

    def __init__(self):
        # Action mappings and descriptions
        self.action_templates = {
            "open_exit": "Open emergency exit gates in the immediate vicinity to relieve density buildup.",
            "reduce_entry": "Temporarily restrict entry gates or throttle incoming queue flow rates.",
            "deploy_security": "Deploy security personnel to assist with crowd organization and prevent surge movement.",
            "divert_crowd": "Divert incoming crowd flows using physical barriers or public address announcements.",
            "start_evacuation": "Initiate orderly, phased evacuation of the affected sector immediately.",
            "close_gate": "Close transit gates to prevent additional crowd influx into the high-density zone.",
            "open_emergency_corridor": "Clear and open dedicated emergency response corridors for first aid access.",
            "monitor": "Maintain active monitoring of the area; verify that crowd flows stabilize.",
            "secure_structure": "Isolate the area surrounding the unstable structure and dispatch structural engineering team."
        }

    def generate_recommendation(
        self,
        level: str,
        alert_type: str,
        zone: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate a response action recommendation text string.

        Args:
            level: The alert level ('info', 'warning', 'high', 'critical').
            alert_type: The type of alert (e.g. 'crowd_density', 'crowd_pressure', 'hazard_movement').
            zone: The target zone or 'Global'.
            extra_data: Additional telemetry data to refine recommendation.

        Returns:
            A string describing the recommended action.
        """
        zone_str = f" in {zone}" if zone and zone != "Global" else ""
        extra_data = extra_data or {}

        if level == "critical":
            if alert_type == "stampede_risk" or alert_type == "crowd_pressure":
                action = "start_evacuation"
                desc = self.action_templates[action]
                return f"CRITICAL EVACUATION [{action}]: {desc} Affected zone: {zone or 'Global'}. Coordinate emergency services immediately."
            
            elif alert_type == "hazard_movement":
                action = "secure_structure"
                desc = self.action_templates[action]
                hazard_class = extra_data.get("class_name", "structure")
                return f"CRITICAL SAFETY AREA [{action}]: {desc} Cordon off the area around the collapsing {hazard_class} immediately."

            else:
                action = "open_exit"
                desc = self.action_templates[action]
                return f"CRITICAL RESPONSE [{action}]: {desc} Deploy local officers to direct crowd outwards."

        elif level == "high":
            if alert_type == "bottleneck":
                action = "divert_crowd"
                desc = self.action_templates[action]
                return f"HIGH DENSITY [{action}]: {desc} Direct crowd flow around {zone or 'bottleneck zone'} to prevent localized crushing."
            
            elif alert_type == "crowd_pressure":
                action = "deploy_security"
                desc = self.action_templates[action]
                return f"HIGH PRESSURE [{action}]: {desc} Deploy physical patrols to form pressure-release wedges{zone_str}."

            elif alert_type == "hazard_movement":
                action = "secure_structure"
                desc = self.action_templates[action]
                hazard_class = extra_data.get("class_name", "structure")
                return f"HIGH HAZARD [{action}]: {desc} Restrict pedestrian access near the tilting {hazard_class}{zone_str}."

            else:
                action = "reduce_entry"
                desc = self.action_templates[action]
                return f"HIGH ALERT [{action}]: {desc} Implement entry flow throttling at main checkpoints."

        elif level == "warning":
            if alert_type == "forecast_warning":
                action = "reduce_entry"
                desc = self.action_templates[action]
                horizon = extra_data.get("prediction_horizon", "+1m")
                return f"PREDICTIVE WARNING [{action}]: {desc} Proactively manage entry flows. Zone {zone or 'Target'} is forecast to overload in {horizon}."

            elif alert_type == "crowd_density":
                action = "divert_crowd"
                desc = self.action_templates[action]
                return f"WARNING [{action}]: {desc} Monitor crowd build-up{zone_str} and divert flow if growth continues."

            else:
                action = "monitor"
                desc = self.action_templates[action]
                return f"WARNING [{action}]: {desc} Maintain camera focus on current sector."

        # Default info/minor alerts
        return f"INFO [monitor]: {self.action_templates['monitor']} Telemetry within acceptable boundaries."
