"""
CrowdShield AI — Core Frame Processor Pipeline
Combines YOLO11 detection, ByteTrack tracking, CSRNet density estimation,
dense optical flow vectors, DBSCAN zone clustering, and CRI risk estimations
to analyze a single frame end-to-end.
"""

import logging
import time
import numpy as np

# AI components imports
from ai.config import YOLO_MODEL, YOLO_CONFIDENCE, YOLO_IOU_THRESHOLD, DEVICE
from ai.tracking.bytetrack import ByteTrackTracker
from ai.tracking.track_manager import TrackManager
from ai.density.csrnet import DensityEstimator
from ai.density.heatmap_generator import generate_heatmap_uri
from ai.flow.optical_flow import OpticalFlowCalculator
from ai.flow.flow_analyzer import FlowAnalyzer
from ai.zones.zone_discovery import ZoneDiscovery
from ai.zones.zone_metrics import calculate_zone_metrics
from ai.pressure.pressure_estimator import PressureEstimator
from ai.pressure.cri_calculator import CRICalculator
from ai.forecasting.forecaster import Forecaster
from ai.forecasting.predictive_heatmap import generate_predictive_heatmap
from ai.hazard.hazard_detector import HazardDetector
from ai.hazard.motion_analyzer import MotionAnalyzer
from ai.alerts.alert_engine import AlertEngine

logger = logging.getLogger("crowdshield.ai.pipeline")


class FrameProcessor:
    """Combines detection, tracking, density, optical flow, zones, and risk models."""

    def __init__(
        self,
        model_name: str = YOLO_MODEL,
        confidence: float = YOLO_CONFIDENCE,
        iou: float = YOLO_IOU_THRESHOLD,
        device: str = DEVICE,
    ):
        # 1. Detection & Tracking
        self.tracker = ByteTrackTracker(
            model_name=model_name,
            confidence=confidence,
            iou=iou,
            device=device,
        )
        self.track_manager = TrackManager()

        # 2. Crowd Density Estimation (CSRNet)
        self.density_estimator = DensityEstimator(device=device)

        # 3. Dense Motion Optical Flow (Farneback)
        self.flow_calculator = OpticalFlowCalculator()
        self.flow_analyzer = FlowAnalyzer()

        # 4. Spatial Zone discovery (DBSCAN)
        self.zone_discovery = ZoneDiscovery()
        self.prev_zones_metrics = {}

        # 5. Pressure & Risk Index
        self.pressure_estimator = PressureEstimator()
        self.cri_calculator = CRICalculator()

        # 6. Spatio-Temporal Forecasting (STGCN)
        self.forecaster = Forecaster()
        
        # 7. Hazard Detection & Alert Engines
        self.hazard_detector = HazardDetector(device=device)
        self.motion_analyzer = MotionAnalyzer()
        self.alert_engine = AlertEngine()
        
        self.last_frame_time = None

    def process(self, frame: np.ndarray, frame_number: int, timestamp: float) -> dict:
        """Process a single frame through all crowd dynamic modules.

        Args:
            frame: OpenCV image array (BGR format).
            frame_number: Sequential index of the frame.
            timestamp: Time offset of the frame in seconds from video start.

        Returns:
            A structured dict matching the frontend/backend schemas for crowd metrics.
        """
        if frame is None:
            return {}

        h, w = frame.shape[:2]

        # Calculate time delta (dt)
        dt = 0.1  # default target frame interval (10 FPS)
        current_time = time.time()
        if self.last_frame_time is not None:
            dt = max(0.01, current_time - self.last_frame_time)
        self.last_frame_time = current_time

        # ─── Module 1: Crowd Detection & ByteTrack Tracking ────────────────────────
        tracked_results = self.tracker.track(frame, persist=True)
        active_tracks = self.track_manager.update(tracked_results, frame_number)
        total_persons = len(active_tracks)

        # ─── Module 2: CSRNet Crowd Density Map & Base64 Heatmap ────────────────────
        density_map = self.density_estimator.estimate(frame.shape, active_tracks)
        heatmap_url = generate_heatmap_uri(density_map, target_shape=(360, 640))

        # ─── Module 3: Dense Optical Flow Analysis ──────────────────────────────────
        flow = self.flow_calculator.compute_flow(frame)
        flow_stats = self.flow_analyzer.analyze(flow, frame.shape)

        # ─── Module 4: Automatic Zone Discovery & Local Metrics ──────────────────────
        discovered_zones = self.zone_discovery.discover_zones(active_tracks, frame.shape)
        
        zones_out = []
        new_zones_metrics = {}

        for zone in discovered_zones:
            zone_id = zone["zone_id"]
            zone_bbox = zone["bbox"]
            zone_dets = zone["detections"]
            
            # Retrieve historical metrics for exponential smoothing
            prev_z_metrics = self.prev_zones_metrics.get(zone_id)
            
            # Calculate zone-level crowd telemetry
            z_metrics = calculate_zone_metrics(
                zone_id=zone_id,
                bbox=zone_bbox,
                detections=zone_dets,
                prev_metrics=prev_z_metrics,
                dt=dt
            )
            zones_out.append(z_metrics)
            new_zones_metrics[zone_id] = z_metrics

        self.prev_zones_metrics = new_zones_metrics

        # ─── Module 5: Global Pressure & Crowd Risk Index (CRI) ──────────────────────
        # Aggregate global metrics
        scene_area_sqm = 60.0  # assumed scene size
        global_density = total_persons / scene_area_sqm
        global_occupancy = min(total_persons / 60.0, 1.0)
        
        global_velocity = flow_stats["velocity_avg"]
        global_consistency = flow_stats["flow_consistency"]
        
        # Speed drop relative to normal free-flow speed
        normal_speed = 5.0
        speed_drop = max(0.0, (1.0 - (global_velocity / normal_speed))) if global_velocity < normal_speed else 0.0
        flow_conflict = 1.0 - global_consistency

        # Local density growth rate (aggregate of positive zone growth rates)
        global_growth_rate = sum(max(0.0, z["growth_rate"]) for z in zones_out) / len(zones_out) if zones_out else 0.0

        # Global pressure estimation
        global_pressure = self.pressure_estimator.compute_pressure(
            density=global_density,
            avg_velocity=global_velocity,
            normal_velocity=normal_speed,
            flow_consistency=global_consistency
        )

        # Smooth global Crowd Risk Index (CRI)
        overall_cri = self.cri_calculator.calculate_cri(
            density=global_density,
            growth_rate=global_growth_rate,
            speed_drop=speed_drop,
            pressure=global_pressure,
            flow_conflict=flow_conflict,
            occupancy=global_occupancy
        )
        risk_level = self.cri_calculator.get_risk_level(overall_cri)

        # ─── Module 6: Spatio-Temporal Forecasting (STGCN) ────────────────────────
        self.forecaster.update_history(zones_out, timestamp)
        predictions = self.forecaster.forecast(zones_out)
        
        predictive_heatmaps = {}
        for name, pred_zones in predictions.items():
            predictive_heatmaps[name] = generate_predictive_heatmap(
                pred_zones, frame.shape, target_shape=(360, 640)
            )

        # ─── Module 7: Infrastructure Hazard Detection & Motion Machine ─────────────
        hazards_out = []
        raw_hazards = self.hazard_detector.detect_hazards(frame, frame_number)
        for hz in raw_hazards:
            h_id = hz["id"]
            bbox = hz["bbox"]
            class_name = hz["class_name"]
            confidence = hz["confidence"]
            
            motion_data = self.motion_analyzer.analyze_motion(h_id, bbox, frame_number)
            
            hazards_out.append({
                "id": h_id,
                "class_name": class_name,
                "bbox": {
                    "x1": round(bbox[0], 1),
                    "y1": round(bbox[1], 1),
                    "x2": round(bbox[2], 1),
                    "y2": round(bbox[3], 1)
                },
                "confidence": confidence,
                "motion_state": motion_data["state"],
                "motion_delta": motion_data["total_drift"],
                "motion_velocity": motion_data["velocity"],
                "motion_acceleration": 0.0,
                "trajectory": motion_data["trajectory"]
            })

        # ─── Module 8: Alert Generation & False Alarm Validation ──────────────────
        frame_summary_for_alerts = {
            "overall_cri": overall_cri,
            "zones": zones_out,
            "forecasts": {
                "+1m": {"zones": predictions["+1m"]},
                "+3m": {"zones": predictions["+3m"]},
                "+5m": {"zones": predictions["+5m"]},
            }
        }
        active_alerts = self.alert_engine.process(
            frame_data=frame_summary_for_alerts,
            hazards=hazards_out,
            timestamp=timestamp
        )

        # Extract track details for detections
        detections_out = []
        for track in active_tracks:
            detections_out.append({
                "bbox": track["bbox"],
                "confidence": track["confidence"],
                "track_id": track["track_id"],
                "velocity": track["velocity"],
                "direction": track["direction"],
                "trajectory": track["trajectory"]
            })

        avg_confidence = 0.0
        if tracked_results:
            avg_confidence = sum(d["confidence"] for d in tracked_results) / len(tracked_results)

        return {
            "type": "crowd_update",
            "frame_number": frame_number,
            "timestamp": round(timestamp, 3),
            "total_persons": total_persons,
            "overall_cri": round(overall_cri, 1),
            "risk_level": risk_level,
            "metrics": {
                "density": round(global_density, 2),
                "occupancy": round(global_occupancy, 3),
                "velocity_avg": round(global_velocity, 2),
                "flow_consistency": round(global_consistency, 3),
                "pressure_score": round(global_pressure, 1),
                "flow_conflict": round(flow_conflict, 3),
                "density_growth_rate": round(global_growth_rate, 3),
                "speed_drop": round(speed_drop * 100.0, 1),
                "counter_flow_ratio": round(flow_stats.get("counter_flow_ratio", 0.0), 3),
            },
            "zones": zones_out,
            "detections": detections_out,
            "detection_confidence_avg": round(avg_confidence, 4),
            "heatmap_url": heatmap_url,
            "flow_arrows": flow_stats["arrows"],
            "hazards": hazards_out,
            "alerts": active_alerts,
            "forecasts": {
                "+1m": {
                    "zones": predictions["+1m"],
                    "heatmap_url": predictive_heatmaps["+1m"],
                },
                "+3m": {
                    "zones": predictions["+3m"],
                    "heatmap_url": predictive_heatmaps["+3m"],
                },
                "+5m": {
                    "zones": predictions["+5m"],
                    "heatmap_url": predictive_heatmaps["+5m"],
                }
            }
        }

    def reset(self):
        """Reset running state between video streams."""
        self.track_manager = TrackManager()
        self.flow_calculator.reset()
        self.prev_zones_metrics = {}
        self.cri_calculator.reset()
        self.forecaster = Forecaster()
        self.motion_analyzer.clear()
        self.alert_engine.clear()
        self.last_frame_time = None
