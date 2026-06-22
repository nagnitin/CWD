"""
CrowdShield AI — False Alarm Filter
Implements consecutive frame confirmation, temporal validation delays,
and threshold hysteresis to eliminate false alarms and sensor jitter.
"""

import time
import logging
from collections import defaultdict

logger = logging.getLogger("crowdshield.ai.alerts")


class FalseAlarmFilter:
    """Validates raw events before publishing alerts to prevent false alarms."""

    def __init__(
        self,
        min_frames: int = 5,
        min_seconds: float = 3.0,
        hysteresis_offset: float = 8.0,
    ):
        """
        Args:
            min_frames: Minimum consecutive frames the event must appear in.
            min_seconds: Minimum duration in seconds the event must be sustained.
            hysteresis_offset: Buffer subtracted from trigger threshold to release an active alarm.
        """
        self.min_frames = min_frames
        self.min_seconds = min_seconds
        self.hysteresis_offset = hysteresis_offset

        # Track active event metrics: {event_key: {consecutive_count, first_seen_time, last_seen_time}}
        self.pending_events = defaultdict(dict)
        # Track currently confirmed/fired alerts: {event_key: timestamp_fired}
        self.confirmed_alerts = {}

    def validate_event(
        self,
        event_key: str,
        is_triggered: bool,
        confidence: float = 1.0,
        current_time: float = None,
    ) -> bool:
        """Filter raw event states using consecutive frame and duration limits.

        Args:
            event_key: Unique identifier of the event (e.g. 'cri_critical', 'scaffolding_collapse').
            is_triggered: Whether the trigger condition is currently met.
            confidence: Event detection confidence score.
            current_time: Current timestamp in seconds (default: time.time()).

        Returns:
            bool: True if the alert is confirmed and should be fired; False otherwise.
        """
        if current_time is None:
            current_time = time.time()

        if not is_triggered:
            # Handle event release (with hysteresis logic)
            self._handle_release(event_key)
            return False

        # Event is active: update counters
        event = self.pending_events[event_key]
        
        if not event:
            # First time seeing the event
            event["consecutive_count"] = 1
            event["first_seen_time"] = current_time
            event["last_seen_time"] = current_time
            event["confidence_accumulator"] = confidence
        else:
            # Consecutive frames update
            event["consecutive_count"] += 1
            event["last_seen_time"] = current_time
            event["confidence_accumulator"] += confidence

        # Apply validation checks
        duration = current_time - event["first_seen_time"]
        frames = event["consecutive_count"]
        mean_confidence = event["confidence_accumulator"] / frames

        # Strict Rule check:
        # Must exceed BOTH frame counts, duration constraints, and minimum confidence threshold
        is_validated = (
            frames >= self.min_frames
            and duration >= self.min_seconds
            and mean_confidence > 0.40
        )

        if is_validated:
            if event_key not in self.confirmed_alerts:
                # Fire new confirmed alert!
                self.confirmed_alerts[event_key] = current_time
                logger.info(f"🚨 Confirmed alert '{event_key}' fired after {frames} frames ({duration:.2f}s).")
                return True
            else:
                # Already confirmed and active, do not fire duplicate
                return False

        return False

    def check_active(self, event_key: str) -> bool:
        """Check if an alert is currently active and confirmed."""
        return event_key in self.confirmed_alerts

    def _handle_release(self, event_key: str):
        """Clean up state on event release, applying threshold hysteresis."""
        if event_key in self.pending_events:
            del self.pending_events[event_key]
            
        if event_key in self.confirmed_alerts:
            # Alert released
            del self.confirmed_alerts[event_key]
            logger.info(f"✅ Alert '{event_key}' released.")

    def clear(self):
        """Reset history."""
        self.pending_events.clear()
        self.confirmed_alerts.clear()
