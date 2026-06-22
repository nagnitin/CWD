"""
CrowdShield AI — AI Engine Unit Tests
Tests for YOLO11 detector, ByteTrack tracker, TrackManager, and FrameProcessor.
"""

import sys
from pathlib import Path
import numpy as np
import pytest

# Add ai/ and backend/ directories to python path for local execution
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(root_dir / "backend"))
sys.path.append(str(root_dir))

from ai.detection.yolo_detector import YoloDetector
from ai.tracking.bytetrack import ByteTrackTracker
from ai.tracking.track_manager import TrackManager
from ai.pipeline.frame_processor import FrameProcessor
from ai.density.csrnet import DensityEstimator
from ai.density.heatmap_generator import generate_heatmap_uri
from ai.flow.optical_flow import OpticalFlowCalculator
from ai.flow.flow_analyzer import FlowAnalyzer
from ai.zones.zone_discovery import ZoneDiscovery
from ai.pressure.pressure_estimator import PressureEstimator
from ai.pressure.cri_calculator import CRICalculator


def test_track_manager():
    """Test velocity, direction, and trajectory computations in TrackManager."""
    manager = TrackManager(max_age=5, max_history=3)
    
    # Frame 1: Initial detection of track ID 1
    det_f1 = [
        {"bbox": [100.0, 100.0, 150.0, 200.0], "confidence": 0.9, "class_id": 0, "track_id": 1}
    ]
    tracks_f1 = manager.update(det_f1, frame_number=1)
    
    assert len(tracks_f1) == 1
    assert tracks_f1[0]["track_id"] == 1
    assert tracks_f1[0]["velocity"] == 0.0
    assert tracks_f1[0]["direction"] == 0.0
    assert len(tracks_f1[0]["trajectory"]) == 1
    
    # Frame 2: Movement of track ID 1 (dx = 30, dy = 40 => displacement = 50)
    det_f2 = [
        {"bbox": [130.0, 140.0, 180.0, 240.0], "confidence": 0.85, "class_id": 0, "track_id": 1}
    ]
    tracks_f2 = manager.update(det_f2, frame_number=2)
    
    assert len(tracks_f2) == 1
    assert tracks_f2[0]["velocity"] == 50.0  # sqrt(30^2 + 40^2)
    assert tracks_f2[0]["direction"] == pytest.approx(53.13, 0.1)  # atan2(40, 30) in degrees
    assert len(tracks_f2[0]["trajectory"]) == 2


def test_frame_processor_structure():
    """Verify that FrameProcessor returns the correct dictionary structure and types."""
    # We use CPU device for testing
    processor = FrameProcessor(device="cpu")
    
    # Create a blank black frame (360x640 BGR)
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    
    result = processor.process(frame, frame_number=0, timestamp=0.0)
    
    assert isinstance(result, dict)
    assert result["type"] == "crowd_update"
    assert result["frame_number"] == 0
    assert result["timestamp"] == 0.0
    assert "total_persons" in result
    assert "overall_cri" in result
    assert "risk_level" in result
    assert "metrics" in result
    assert "zones" in result
    assert "detections" in result
    assert "hazards" in result
    assert "alerts" in result
    
    # Metrics fields
    metrics = result["metrics"]
    for field in ["density", "occupancy", "velocity_avg", "flow_consistency", "pressure_score", "flow_conflict"]:
        assert field in metrics
    
    # Check that heatmap and flow arrows are present
    assert "heatmap_url" in result
    assert "flow_arrows" in result
    assert result["heatmap_url"].startswith("data:image/png;base64,")


def test_density_estimator_and_heatmap():
    """Test the DensityEstimator shape and generated base64 PNG heatmap output."""
    estimator = DensityEstimator(device="cpu")
    
    detections = [
        {"bbox": [100.0, 100.0, 150.0, 200.0], "confidence": 0.9, "class_id": 0, "track_id": 1},
        {"bbox": [300.0, 150.0, 350.0, 250.0], "confidence": 0.8, "class_id": 0, "track_id": 2}
    ]
    
    # 720x1280 frame -> output resolution should be 1/8 i.e., 90x160
    density_map = estimator.estimate((720, 1280), detections)
    
    assert density_map.shape == (90, 160)
    assert density_map.sum() > 0.0  # check that we mapped points
    
    # Generate base64 data URI
    uri = generate_heatmap_uri(density_map, target_shape=(180, 320))
    assert isinstance(uri, str)
    assert uri.startswith("data:image/png;base64,")


def test_optical_flow_and_analyzer():
    """Test the OpticalFlowCalculator and FlowAnalyzer computations."""
    calculator = OpticalFlowCalculator(downsample_width=80, downsample_height=45)
    analyzer = FlowAnalyzer(magnitude_threshold=0.1, grid_step=10)
    
    # Frame 1: Blank
    f1 = np.zeros((360, 640, 3), dtype=np.uint8)
    flow1 = calculator.compute_flow(f1)
    assert flow1 is None  # first frame yields no flow
    
    # Frame 2: Shifted pixels to simulate motion (moving right by 4 pixels)
    f2 = np.zeros((360, 640, 3), dtype=np.uint8)
    f2[:, 10:] = 255
    flow2 = calculator.compute_flow(f2)
    
    assert flow2 is not None
    assert flow2.shape == (45, 80, 2)
    
    # Analyze flow
    stats = analyzer.analyze(flow2, (360, 640))
    assert isinstance(stats, dict)
    assert "velocity_avg" in stats
    assert "flow_consistency" in stats
    assert "flow_direction" in stats
    assert "arrows" in stats
    
    # Sampled arrows should map coordinates scaled to the original frame size
    for arrow in stats["arrows"]:
        assert 0 <= arrow["x"] <= 640
        assert 0 <= arrow["y"] <= 360


def test_zone_discovery_clustering():
    """Test that ZoneDiscovery clusters coordinates or returns the fallback static columns."""
    discovery = ZoneDiscovery(eps=100.0, min_samples=2)
    
    # Group 1: 3 close detections (should form one cluster/zone)
    # Group 2: 2 close detections (should form another cluster/zone)
    detections = [
        {"bbox": [10.0, 10.0, 20.0, 20.0]},
        {"bbox": [12.0, 12.0, 22.0, 22.0]},
        {"bbox": [15.0, 15.0, 25.0, 25.0]},
        
        {"bbox": [500.0, 500.0, 510.0, 510.0]},
        {"bbox": [505.0, 505.0, 515.0, 515.0]},
    ]
    
    zones = discovery.discover_zones(detections, (1080, 1920))
    
    # Should yield at least 2 discovered zones/clusters (label 0 and 1)
    assert len(zones) >= 2
    for zone in zones:
        assert "zone_id" in zone
        assert "bbox" in zone
        assert "detections" in zone


def test_pressure_and_cri_estimation():
    """Test crowd pressure score and smoothed Crowd Risk Index calculations."""
    pressure_est = PressureEstimator()
    cri_calc = CRICalculator(smoothing_factor=0.2)
    
    # Low density, normal velocity
    p_low = pressure_est.compute_pressure(density=0.1, avg_velocity=5.0, flow_consistency=1.0)
    assert p_low == pytest.approx(0.24, 0.1)
    
    # High density, speed drop
    p_high = pressure_est.compute_pressure(density=4.0, avg_velocity=1.0, flow_consistency=0.5)
    assert p_high > p_low
    
    # Calculate CRI
    cri_1 = cri_calc.calculate_cri(
        density=0.5, growth_rate=0.0, speed_drop=0.0, pressure=10.0, flow_conflict=0.1, occupancy=0.1
    )
    
    # Apply smoothing on subsequent frame
    cri_2 = cri_calc.calculate_cri(
        density=0.6, growth_rate=0.1, speed_drop=0.0, pressure=12.0, flow_conflict=0.1, occupancy=0.12
    )
    
    assert 0.0 <= cri_1 <= 100.0
    assert 0.0 <= cri_2 <= 100.0
    assert cri_calc.get_risk_level(cri_1) in ["safe", "moderate", "high", "critical"]


def test_forecasting_and_graphs():
    """Test GraphBuilder, Forecaster and predictive heatmap interpolations."""
    from ai.forecasting.graph_builder import GraphBuilder
    from ai.forecasting.forecaster import Forecaster
    from ai.forecasting.predictive_heatmap import generate_predictive_heatmap
    
    # Setup mock zones
    zones = [
        {"zone_id": "zone_a", "bbox": {"x1": 100.0, "y1": 100.0, "x2": 300.0, "y2": 400.0}, "density": 0.5, "pressure_score": 10.0, "risk_score": 15.0},
        {"zone_id": "zone_b", "bbox": {"x1": 400.0, "y1": 100.0, "x2": 600.0, "y2": 400.0}, "density": 1.2, "pressure_score": 25.0, "risk_score": 30.0},
    ]
    
    # 1. GraphBuilder
    builder = GraphBuilder(distance_threshold=500.0)
    adj, laplacian = builder.build_graph(zones)
    
    assert adj.shape == (2, 2)
    assert laplacian.shape == (2, 2)
    assert adj[0, 1] > 0.0  # connected because distance is ~300 < 500
    
    # 2. Forecaster
    forecaster = Forecaster(history_length=5)
    
    # Feed historical ticks to establish slopes
    for i in range(5):
        # incrementally increase metrics to create positive slope
        frame_zones = [
            {"zone_id": "zone_a", "bbox": zones[0]["bbox"], "density": 0.5 + i * 0.1, "pressure_score": 10.0 + i * 2, "risk_score": 15.0 + i * 3},
            {"zone_id": "zone_b", "bbox": zones[1]["bbox"], "density": 1.2 + i * 0.2, "pressure_score": 25.0 + i * 3, "risk_score": 30.0 + i * 4},
        ]
        forecaster.update_history(frame_zones, timestamp=i * 2.5)
        
    predictions = forecaster.forecast(frame_zones)
    
    assert "+1m" in predictions
    assert "+3m" in predictions
    assert "+5m" in predictions
    
    pred_1m_a = [z for z in predictions["+1m"] if z["zone_id"] == "zone_a"][0]
    assert pred_1m_a["density"] > 0.9  # 0.9 + slope * 60s
    assert pred_1m_a["risk_score"] > 27.0
    
    # 3. Predictive Heatmaps
    h_uri = generate_predictive_heatmap(predictions["+1m"], (720, 1280))
    assert isinstance(h_uri, str)
    assert h_uri.startswith("data:image/png;base64,")


def test_false_alarm_filter():
    """Verify consecutive frames and duration confirmation logic in FalseAlarmFilter."""
    from ai.alerts.false_alarm_filter import FalseAlarmFilter
    
    # 5 frames, 3.0s threshold
    f_filter = FalseAlarmFilter(min_frames=5, min_seconds=3.0)
    
    event_key = "test_event"
    
    # Frame 1: Triggered, confidence 0.9, time 0.0s (Not enough frames or seconds)
    assert not f_filter.validate_event(event_key, is_triggered=True, confidence=0.9, current_time=0.0)
    assert not f_filter.check_active(event_key)
    
    # Frame 2-4: Triggered, time up to 2.0s
    for i in range(2, 5):
        assert not f_filter.validate_event(event_key, is_triggered=True, confidence=0.9, current_time=i * 0.7)
        assert not f_filter.check_active(event_key)
        
    # Frame 5: Triggered, time 3.5s. Exceeds 5 frames AND 3.0 seconds -> confirmed!
    assert f_filter.validate_event(event_key, is_triggered=True, confidence=0.9, current_time=3.5)
    assert f_filter.check_active(event_key)
    
    # Subsequent frame: still active, validate_event returns False (no duplicate fire) but check_active is True
    assert not f_filter.validate_event(event_key, is_triggered=True, confidence=0.9, current_time=4.0)
    assert f_filter.check_active(event_key)
    
    # Event released: turns off trigger
    assert not f_filter.validate_event(event_key, is_triggered=False, current_time=5.0)
    assert not f_filter.check_active(event_key)


def test_motion_analyzer_state_machine():
    """Verify that MotionAnalyzer accurately transitions hazard motion states."""
    from ai.hazard.motion_analyzer import MotionAnalyzer
    
    analyzer = MotionAnalyzer(history_len=20)
    hazard_id = "haz_1"
    
    # Initial: state STATIC
    m1 = analyzer.analyze_motion(hazard_id, bbox=[100.0, 100.0, 200.0, 200.0], frame_number=1)
    assert m1["state"] == "STATIC"
    assert m1["velocity"] == 0.0
    
    # Small drift: 100 -> 103 (distance 3.0). Under 4.0 threshold, state STATIC
    m2 = analyzer.analyze_motion(hazard_id, bbox=[103.0, 100.0, 203.0, 200.0], frame_number=2)
    assert m2["state"] == "STATIC"
    
    # Larger drift: 100 -> 105 (distance 5.0). Exceeds 4.0 threshold, state MONITORING
    m3 = analyzer.analyze_motion(hazard_id, bbox=[105.0, 100.0, 205.0, 200.0], frame_number=3)
    assert m3["state"] == "MONITORING"
    
    # Fast move: total drift 25.0, velocity 20.0. Exceeds 20.0 drift and 0.8 velocity -> ALERTING
    m4 = analyzer.analyze_motion(hazard_id, bbox=[125.0, 100.0, 225.0, 200.0], frame_number=4)
    assert m4["state"] == "ALERTING"
    
    # Collapse speed: total drift 80.0, velocity 55.0. Exceeds 65.0 drift -> CRITICAL
    m5 = analyzer.analyze_motion(hazard_id, bbox=[180.0, 100.0, 280.0, 200.0], frame_number=5)
    assert m5["state"] == "CRITICAL"


def test_alert_engine_processing():
    """Verify that AlertEngine filters false alarms and executes recommendations."""
    from ai.alerts.alert_engine import AlertEngine
    
    engine = AlertEngine(min_frames=3, min_seconds=1.0)
    
    # Mock data with critical CRI (90)
    frame_data = {
        "overall_cri": 90.0,
        "zones": [],
        "forecasts": {}
    }
    hazards = []
    
    # Frame 1: time 0.0s (CRI triggers, but alert is not confirmed yet due to filters)
    alerts = engine.process(frame_data, hazards, timestamp=0.0)
    assert len(alerts) == 0
    
    # Frame 2: time 0.5s
    alerts = engine.process(frame_data, hazards, timestamp=0.5)
    assert len(alerts) == 0
    
    # Frame 3: time 1.2s. Exceeds 3 frames and 1.0 seconds -> confirmed!
    alerts = engine.process(frame_data, hazards, timestamp=1.2)
    assert len(alerts) == 1
    
    alert = alerts[0]
    assert alert["level"] == "critical"
    assert alert["alert_type"] == "stampede_risk"
    assert "CRITICAL EVACUATION" in alert["recommended_action"]
    assert alert["confirmation_frames"] == 3
    assert alert["persistence_seconds"] == 1.2


