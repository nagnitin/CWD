"""
CrowdShield AI — Lightweight Mock Backend API & WebSocket Server
Runs on port 8000, zero-database dependencies, zero-GPU/AI-model dependencies.
Allows testing all frontend pages with fully interactive simulated crowd telemetry.
"""

import os
import uuid
import json
import time
import math
import random
import asyncio
import requests
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(
    title="CrowdShield AI (Mock Backend)",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Mount uploads static serving
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# In-memory database for videos
videos = {}

class VideoResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    filepath: str
    file_size: int
    mime_type: str | None = None
    duration: float | None = None
    fps: float | None = None
    width: int | None = None
    height: int | None = None
    bitrate: int | None = None
    codec: str | None = None
    total_frames: int | None = None
    status: str
    processing_progress: float
    error_message: str | None = None
    uploaded_at: str
    processed_at: str | None = None

class VideoProcessRequest(BaseModel):
    processing_fps: int = 10
    enable_tracking: bool = True
    enable_density: bool = True
    enable_flow: bool = True
    api_key: str | None = None
    model: str = "gemini-2.5-flash"

class WebSocketManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

ws_manager = WebSocketManager()

@app.get("/")
async def root():
    return {
        "name": "CrowdShield AI (Mock Server)",
        "version": "1.0.0",
        "status": "operational",
        "mock_mode": True,
    }

@app.post("/api/v1/videos/upload", status_code=201)
async def upload_video(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    video_id = str(uuid.uuid4())
    safe_filename = f"{video_id}{suffix}"
    filepath = UPLOAD_DIR / safe_filename
    
    # Save the file locally
    try:
        with open(filepath, "wb") as buffer:
            shutil = __import__('shutil')
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    file_size = filepath.stat().st_size
    
    # Simulated metadata
    video = {
        "id": video_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "filepath": str(filepath),
        "file_size": file_size,
        "mime_type": file.content_type or "video/mp4",
        "duration": 18.0,
        "fps": 30.0,
        "width": 1280,
        "height": 720,
        "bitrate": 3000,
        "codec": "h264",
        "total_frames": 540,
        "status": "uploaded",
        "processing_progress": 0.0,
        "uploaded_at": datetime.now().isoformat(),
        "processed_at": None
    }
    
    videos[video_id] = video
    return video

def detect_contours_in_frame(video_path: str, frame_idx: int) -> list:
    import cv2
    import numpy as np
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []
            
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, frame_idx - 3))
        ret1, f1 = cap.read()
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret2, f2 = cap.read()
        cap.release()
        
        if not ret1 or not ret2:
            return []
            
        # Resize to standard analysis resolution
        f1 = cv2.resize(f1, (1280, 720))
        f2 = cv2.resize(f2, (1280, 720))
        
        # Differencing & Thresholding
        gray1 = cv2.cvtColor(f1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(f2, cv2.COLOR_BGR2GRAY)
        
        diff = cv2.absdiff(gray1, gray2)
        _, thresh = cv2.threshold(diff, 12, 255, cv2.THRESH_BINARY)
        
        # Dilate contours vertically
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 30))
        dilated = cv2.dilate(thresh, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detections = []
        track_id = 200
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            if 20 < w < 300 and 45 < h < 450:
                detections.append({
                    "bbox": {"x1": x, "y1": y, "x2": x + w, "y2": y + h},
                    "confidence": round(float(0.75 + (w * h) % 20 / 100.0), 2),
                    "track_id": track_id
                })
                track_id += 1
                if len(detections) >= 20:
                    break
                    
        return detections
    except Exception as e:
        print(f"detect_contours_in_frame error: {e}")
        return []

def generate_opencv_metrics(video_path: str, frame_idx: int, idx: int, video_id: str | None, video: dict) -> dict:
    raw_detections = detect_contours_in_frame(video_path, frame_idx)
    person_count = len(raw_detections)
    
    # Calculate deterministic metrics
    density = person_count / 20.0
    velocity_avg = 1.8 if person_count > 0 else 0.0
    pressure_score = min(100.0, density * velocity_avg * 10)
    cri = min(100, int(density * 15 + velocity_avg * 10))
    risk_level = "safe" if cri <= 25 else "moderate" if cri <= 50 else "high" if cri <= 75 else "critical"
    
    return {
        "total_persons": person_count,
        "density": round(density, 2),
        "velocity_avg": velocity_avg,
        "pressure_score": round(pressure_score, 1),
        "risk_level": risk_level,
        "overall_cri": cri,
        "safety_assessment": f"Active motion tracking: detected {person_count} dynamic crowd contours.",
        "scaffolding_hazard": {
            "state": "STATIC",
            "displacement": 0.0,
            "velocity": 0.0,
            "severity": "none"
        },
        "detections": raw_detections
    }

def generate_dynamic_flow_arrows(detections: list, t: float = 0.0) -> list:
    import math
    flow_arrows = []
    for row in range(4):
        for col in range(6):
            grid_x = 200 + col * 175
            grid_y = 100 + row * 160
            
            near_crowd = False
            dx, dy = 0.0, 0.0
            for det in detections:
                bbox = det.get("bbox")
                if bbox:
                    cx = (bbox["x1"] + bbox["x2"]) / 2.0
                    cy = (bbox["y1"] + bbox["y2"]) / 2.0
                    dist = math.sqrt((grid_x - cx)**2 + (grid_y - cy)**2)
                    if dist < 220:
                        near_crowd = True
                        angle_rad = math.radians(det.get("direction", 90.0))
                        mag = det.get("velocity", 3.5) * 6.0
                        dx += mag * math.cos(angle_rad)
                        dy += mag * math.sin(angle_rad)
            
            if near_crowd:
                magnitude = math.sqrt(dx*dx + dy*dy)
                magnitude = min(35.0, max(5.0, magnitude))
                angle = math.atan2(dy, dx)
                flow_arrows.append({
                    "x": grid_x,
                    "y": grid_y,
                    "dx": magnitude * math.cos(angle),
                    "dy": magnitude * math.sin(angle),
                    "magnitude": round(magnitude, 1)
                })
            else:
                flow_arrows.append({
                    "x": grid_x,
                    "y": grid_y,
                    "dx": 0.0,
                    "dy": 0.0,
                    "magnitude": 0.0
                })
    return flow_arrows

@app.post("/api/v1/videos/{video_id}/process")
async def process_video(video_id: str, request: VideoProcessRequest = VideoProcessRequest()):
    if video_id not in videos:
        raise HTTPException(status_code=404, detail="Video not found")
        
    video = videos[video_id]
    
    if video["status"] == "processing":
        raise HTTPException(status_code=409, detail="Video is already being processed")
        
    video["status"] = "processing"
    video["processing_progress"] = 0.0
    
    # Background worker task to run actual frame extraction and analysis with Gemini
    async def run_pipeline():
        import cv2
        api_key = resolve_api_key(request.api_key, None)
        model = request.model
        
        frame_metrics = []
        cap = cv2.VideoCapture(video["filepath"])
        if cap.isOpened():
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            # Pick 10 indices
            num_samples = 10
            indices = [int(i * total_frames / num_samples) for i in range(num_samples)]
            quota_exceeded = False
            active_tracks = {}
            for idx, f_idx in enumerate(indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
                ret, frame = cap.read()
                
                res = None
                if ret and not quota_exceeded:
                    frame_resized = cv2.resize(frame, (1280, 720))
                    res = analyze_frame_with_gemini(frame_resized, api_key, model)
                    if res and isinstance(res, dict) and res.get("rate_limited"):
                        quota_exceeded = True
                        print("Gemini rate limit (429) hit during frame processing. Switching to OpenCV motion metrics for remaining frames.")
                        res = None
                        
                # Fallback to OpenCV local contour differencing detector if Gemini fails or rate-limits
                if not res:
                    res = generate_opencv_metrics(video["filepath"], f_idx, idx, video_id, video)
                
                # Enrich bounding boxes with dynamic tracking history (velocity, direction, trajectory)
                raw_detections = res.get("detections", [])
                enriched = []
                for d_idx, det in enumerate(raw_detections):
                    bbox = det.get("bbox")
                    if not bbox:
                        continue
                    track_id = det.get("track_id") or (200 + d_idx)
                    cx = (bbox.get("x1", 0) + bbox.get("x2", 0)) / 2.0
                    cy = (bbox.get("y1", 0) + bbox.get("y2", 0)) / 2.0
                    
                    if track_id not in active_tracks:
                        active_tracks[track_id] = {
                            "last_cx": cx,
                            "last_cy": cy,
                            "trajectory": [{"x": cx, "y": cy}],
                            "duration_frames": 1,
                            "velocity": 0.0,
                            "direction": 0.0
                        }
                    else:
                        t_data = active_tracks[track_id]
                        dx = cx - t_data["last_cx"]
                        dy = cy - t_data["last_cy"]
                        velocity = math.sqrt(dx*dx + dy*dy)
                        direction = math.degrees(math.atan2(dy, dx))
                        traj = list(t_data["trajectory"]) + [{"x": cx, "y": cy}]
                        if len(traj) > 6:
                            traj.pop(0)
                        active_tracks[track_id] = {
                            "last_cx": cx,
                            "last_cy": cy,
                            "trajectory": traj,
                            "duration_frames": t_data["duration_frames"] + 1,
                            "velocity": round(velocity, 2),
                            "direction": round(direction, 1)
                        }
                    
                    t_info = active_tracks[track_id]
                    enriched.append({
                        "bbox": bbox,
                        "confidence": det.get("confidence", 0.95),
                        "track_id": track_id,
                        "velocity": t_info["velocity"],
                        "direction": t_info["direction"],
                        "trajectory": t_info["trajectory"],
                        "duration_frames": t_info["duration_frames"]
                    })
                
                res["detections"] = enriched
                
                # Synthesize flow arrows dynamically near active detections
                res["flow_arrows"] = generate_dynamic_flow_arrows(enriched, t=idx * 30 / 30.0)
                
                # Generate dynamic colormapped transparent heatmap base64 data URL
                res["heatmap_url"] = generate_heatmap_data_url(enriched)
                
                # Synthesize standard zones if missing
                if "zones" not in res:
                    person_count = res.get("total_persons", 0)
                    density = res.get("density", 0.0)
                    cri = res.get("overall_cri", 0)
                    res["zones"] = [
                        {
                            "zone_id": "Sector_A_Ghat",
                            "person_count": max(0, int(person_count * 0.45)),
                            "density": round(density * 1.1, 2),
                            "risk_score": round(cri * 1.05, 1),
                            "risk_level": "critical" if cri > 70 else "high" if cri > 45 else "moderate" if cri > 20 else "safe",
                        },
                        {
                            "zone_id": "Sector_B_Plaza",
                            "person_count": max(0, int(person_count * 0.35)),
                            "density": round(density * 0.9, 2),
                            "risk_score": round(cri * 0.85, 1),
                            "risk_level": "high" if cri > 80 else "moderate" if cri > 35 else "safe",
                        },
                        {
                            "zone_id": "Sector_C_Barricades",
                            "person_count": max(0, int(person_count * 0.20)),
                            "density": round(density * 0.65, 2),
                            "risk_score": round(cri * 0.6, 1),
                            "risk_level": "moderate" if cri > 60 else "safe",
                        }
                    ]
                
                frame_metrics.append(res)
                
                progress_pct = float((idx + 1) * 10)
                video["processing_progress"] = progress_pct
                await ws_manager.broadcast({
                    "video_id": video_id,
                    "progress": progress_pct,
                    "status": "processing" if progress_pct < 100 else "processed"
                })
                # Stagger only if Gemini API succeeded, otherwise OpenCV runs instantly
                if ret and not quota_exceeded:
                    await asyncio.sleep(2.5)
                else:
                    await asyncio.sleep(0.1)
            cap.release()
        else:
            error_msg = f"Failed to open video file {video['original_filename']}. The file might be corrupt or an invalid video format."
            print(error_msg)
            video["status"] = "failed"
            video["error_message"] = error_msg
            video["processing_progress"] = 0.0
            await ws_manager.broadcast({
                "video_id": video_id,
                "progress": 0.0,
                "status": "failed",
                "error_message": error_msg
            })
            return
        
        video["frame_metrics"] = frame_metrics
        video["status"] = "processed"
        video["processed_at"] = datetime.now().isoformat()
        
    asyncio.create_task(run_pipeline())
    return {"status": "processing"}

def generate_heatmap_data_url(detections: list, width: int = 1280, height: int = 720) -> str:
    import numpy as np
    import cv2
    import base64
    
    try:
        # Create single-channel density map
        density_map = np.zeros((height, width), dtype=np.float32)
        for det in detections:
            bbox = det.get("bbox")
            if not bbox:
                continue
            cx = int((bbox.get("x1", 0) + bbox.get("x2", 0)) / 2.0)
            cy = int((bbox.get("y1", 0) + bbox.get("y2", 0)) / 2.0)
            # Draw a solid circular gradient blob
            cv2.circle(density_map, (cx, cy), 80, 1.0, -1)
            
        # Blur the density map to make smooth gradients
        density_map = cv2.GaussianBlur(density_map, (151, 151), 0)
        
        # Normalize density map to 0-255
        if density_map.max() > 0:
            density_map = (density_map / density_map.max() * 255).astype(np.uint8)
        else:
            density_map = density_map.astype(np.uint8)
            
        # Apply JET colormap (blue = low, red = high density)
        heatmap_color = cv2.applyColorMap(density_map, cv2.COLORMAP_JET)
        
        # Create RGBA image
        rgba = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2BGRA)
        
        # Set alpha channel proportional to density: max alpha of 130 for visibility
        rgba[:, :, 3] = (density_map.astype(np.float32) * (130.0 / 255.0)).astype(np.uint8)
        
        # Encode to PNG base64
        success, encoded = cv2.imencode('.png', rgba)
        if not success:
            return ""
        base64_str = base64.b64encode(encoded.tobytes()).decode('utf-8')
        return f"data:image/png;base64,{base64_str}"
    except Exception as e:
        print(f"generate_heatmap_data_url error: {e}")
        return ""

# Realistic simulation metrics matching main feed metrics
def generate_simulated_metrics(frame: int, video_id: str | None = None) -> dict:
    t = frame / 30.0  # 30 fps speed
    
    # Sine wave patterns for crowd counts
    base_count = 55 + 25 * math.sin(t * 0.15) + 12 * math.cos(t * 0.4)
    person_count = max(0, int(base_count + random.gauss(0, 4)))
    
    density = min(person_count / 120.0, 1.0) * 5.5  # p/m^2
    occupancy = min(person_count / 140.0, 1.0)
    
    velocity = max(0.4, 4.8 - density * 0.6 + random.gauss(0, 0.2))
    flow_consistency = max(0.15, 0.92 - density * 0.08 + random.gauss(0, 0.04))
    pressure = min(100.0, (density ** 1.8) * 4.0 + random.gauss(0, 1.5))
    
    # Calculate CRI score
    density_norm = min(density / 6.0, 1.0) * 100
    growth_rate = max(0.0, math.sin(t * 0.2) * 15 + random.gauss(0, 2))
    speed_drop = max(0.0, (1.0 - velocity / 4.8) * 100)
    flow_conflict = max(0.0, min(100.0, random.gauss(15, 8) + density * 6))
    
    cri = (
        density_norm * 0.20
        + growth_rate * 0.15
        + speed_drop * 0.15
        + pressure * 0.20
        + flow_conflict * 0.15
        + (occupancy * 100) * 0.15
    )
    cri = max(0, min(100, int(cri)))
    
    risk_level = "safe" if cri <= 25 else "moderate" if cri <= 50 else "high" if cri <= 75 else "critical"
       # Generate dynamic visual detections with tracking bounding boxes (linear corridor flow)
    detections = []
    num_detections = min(person_count, 15)
    for i in range(num_detections):
        track_id = 200 + i
        flow_speed = 3.5  # pixels per frame
        # Position determined by time t and stagger index i
        y_pos = (t * 40 + i * 160) % 800 - 50  # wrap around from -50 to 750
        
        # Spread across the screen width (150px to 1130px) to match landscape layouts
        x_pos = 150 + ((i * 190 + int(t * 15)) % 980)
        
        w, h = 45, 110  # realistic person bounding box size
        x1 = x_pos - w/2
        y1 = y_pos - h/2
        
        # Build trail path (linear trail backwards)
        trajectory = []
        for hist_step in range(6):
            hist_t = t - hist_step * 0.2
            hist_y = (hist_t * 40 + i * 160) % 800 - 50
            hist_x = 150 + ((i * 190 + int(hist_t * 15)) % 980)
            trajectory.append({
                "x": hist_x,
                "y": hist_y
            })
            
        detections.append({
            "track_id": track_id,
            "bbox": {"x1": x1, "y1": y1, "x2": x1 + w, "y2": y1 + h},
            "velocity": flow_speed + random.uniform(-0.5, 0.5),
            "direction": 90.0 + random.uniform(-5, 5),  # 90 degrees is straight down
            "trajectory": trajectory
        })
        
    # Flow arrows for vector visualization (dynamically generated near active detections)
    flow_arrows = generate_dynamic_flow_arrows(detections, t=t)
            
    # Generate dynamic, real transparent density heatmap data URL in memory
    h_url = generate_heatmap_data_url(detections)
    
    return {
        "type": "crowd_update",
        "video_id": video_id,
        "frame_number": frame,
        "timestamp": round(t, 3),
        "total_persons": person_count,
        "overall_cri": cri,
        "risk_level": risk_level,
        "metrics": {
            "density": round(density, 2),
            "occupancy": round(occupancy, 3),
            "velocity_avg": round(velocity, 2),
            "flow_consistency": round(flow_consistency, 3),
            "pressure_score": round(pressure, 1),
            "flow_conflict": round(flow_conflict / 100, 3),
            "density_growth_rate": round(growth_rate, 2),
            "speed_drop": round(speed_drop, 1),
            "counter_flow_ratio": round(random.uniform(0.05, 0.25), 3),
        },
        "zones": [
            {
                "zone_id": "Sector_A_Ghat",
                "person_count": max(0, int(person_count * 0.45)),
                "density": round(density * 1.1, 2),
                "risk_score": round(cri * 1.05, 1),
                "risk_level": "critical" if cri > 70 else "high" if cri > 45 else "moderate" if cri > 20 else "safe",
            },
            {
                "zone_id": "Sector_B_Plaza",
                "person_count": max(0, int(person_count * 0.35)),
                "density": round(density * 0.9, 2),
                "risk_score": round(cri * 0.85, 1),
                "risk_level": "high" if cri > 80 else "moderate" if cri > 35 else "safe",
            },
            {
                "zone_id": "Sector_C_Barricades",
                "person_count": max(0, int(person_count * 0.20)),
                "density": round(density * 0.65, 2),
                "risk_score": round(cri * 0.6, 1),
                "risk_level": "moderate" if cri > 60 else "safe",
            }
        ],
        "detections": detections,
        "flow_arrows": flow_arrows,
        "heatmap_url": h_url
    }

def get_idle_metrics():
    return {
        "type": "crowd_update",
        "video_id": None,
        "frame_number": 0,
        "timestamp": 0.0,
        "total_persons": 0,
        "overall_cri": 0,
        "risk_level": "safe",
        "metrics": {
            "density": 0.0,
            "occupancy": 0.0,
            "velocity_avg": 0.0,
            "flow_consistency": 1.0,
            "pressure_score": 0.0,
            "flow_conflict": 0.0,
            "density_growth_rate": 0.0,
            "speed_drop": 0.0,
            "counter_flow_ratio": 0.0,
        },
        "zones": [
            {
                "zone_id": "Sector_A_Ghat",
                "person_count": 0,
                "density": 0.0,
                "risk_score": 0.0,
                "risk_level": "safe",
            },
            {
                "zone_id": "Sector_B_Plaza",
                "person_count": 0,
                "density": 0.0,
                "risk_score": 0.0,
                "risk_level": "safe",
            },
            {
                "zone_id": "Sector_C_Barricades",
                "person_count": 0,
                "density": 0.0,
                "risk_score": 0.0,
                "risk_level": "safe",
            }
        ],
        "scaffolding_hazard": {
            "state": "STATIC",
            "displacement": 0.0,
            "velocity": 0.0,
            "severity": "none"
        },
        "detections": [],
        "flow_arrows": [],
        "heatmap_url": ""
    }

@app.websocket("/ws/live")
async def live_feed(websocket: WebSocket):
    await ws_manager.connect(websocket)
    frame = 0
    try:
        while True:
            # Detect active processing/processed video
            active_video_id = None
            for vid_id, vid in list(videos.items()):
                if vid["status"] in ["processing", "processed"]:
                    active_video_id = vid_id
                    break
            
            if active_video_id and videos[active_video_id].get("frame_metrics"):
                metrics_list = videos[active_video_id]["frame_metrics"]
                if len(metrics_list) > 0:
                    current_metrics = metrics_list[frame % len(metrics_list)]
                    metrics = dict(current_metrics)
                    metrics["type"] = "crowd_update"
                    metrics["video_id"] = active_video_id
                    metrics["frame_number"] = frame
                    metrics["timestamp"] = round(frame * 0.1, 3)
                else:
                    metrics = get_idle_metrics()
            else:
                metrics = get_idle_metrics()
                
            await websocket.send_json(metrics)
            frame += 1
            await asyncio.sleep(0.1)  # 10 Hz
    except Exception:
        ws_manager.disconnect(websocket)

@app.websocket("/ws/alerts")
async def alert_feed(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(5.0)
            await websocket.send_json({"type": "heartbeat", "timestamp": time.time()})
    except Exception:
        pass

# Cameras mock endpoints
@app.get("/api/v1/cameras/")
async def list_cameras():
    return [
        {"id": "cam_1", "name": "Sector A Ghat Main", "status": "active"},
        {"id": "cam_2", "name": "Sector B Plaza Entrance", "status": "active"},
        {"id": "cam_3", "name": "Sector C Flow Barricade", "status": "inactive"}
    ]

@app.post("/api/v1/cameras/")
async def create_camera(data: dict):
    return {
        "id": f"cam_{random.randint(10,99)}",
        "name": data.get("name", "New Camera"),
        "status": "active"
    }

@app.post("/api/v1/cameras/{camera_id}/test")
async def test_camera(camera_id: str):
    return {"connected": True, "latency_ms": random.randint(10, 45)}

@app.delete("/api/v1/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    return {"status": "deleted"}

# ─── Gemini AI Schemas ────────────────────────────────────────

class GeminiTestRequest(BaseModel):
    api_key: str | None = None
    model: str = "gemini-2.5-flash"

class GeminiCopilotRequest(BaseModel):
    message: str
    metrics: dict | None = None
    api_key: str | None = None
    model: str = "gemini-2.5-flash"

class GeminiForecastRequest(BaseModel):
    history: list[int]
    api_key: str | None = None
    model: str = "gemini-2.5-flash"

class GeminiHazardRequest(BaseModel):
    displacement: float
    velocity: float
    state: str
    severity: str
    api_key: str | None = None
    model: str = "gemini-2.5-flash"

# ─── Gemini REST Helper ────────────────────────────────────────

def call_gemini(api_key: str, model: str, system_instruction: str, prompt: str) -> str:
    if not api_key:
        return "Error: Gemini API Key is missing. Please configure it in Settings."
    
    models_to_try = [model]
    for fallback in ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)
            
    last_error = ""
    for current_model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [
                    {"text": system_instruction}
                ]
            }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            if response.status_code == 200:
                result = response.json()
                try:
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return f"Unexpected Gemini API response structure. Response: {response.text}"
            else:
                try:
                    err_detail = response.json().get("error", {}).get("message", response.text)
                except Exception:
                    err_detail = response.text
                last_error = f"Gemini API Error (HTTP {response.status_code}): {err_detail}"
                print(f"call_gemini: model {current_model} failed. Details: {last_error}")
        except Exception as e:
            last_error = f"Failed to connect to Gemini API: {str(e)}"
            print(f"call_gemini: exception with model {current_model}. Details: {last_error}")
            
    return last_error

def analyze_frame_with_gemini(frame, api_key: str, model: str = "gemini-2.5-flash") -> dict | None:
    import base64
    import cv2
    import json
    
    success, encoded = cv2.imencode('.jpg', frame)
    if not success:
        print("Failed to encode frame to JPEG")
        return None
        
    base64_img = base64.b64encode(encoded.tobytes()).decode('utf-8')
    
    models_to_try = [model]
    for fallback in ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)
            
    prompt = (
        "You are an advanced crowd safety AI. Analyze this video frame. "
        "Estimate the total number of people in the crowd. Detect bounding boxes for up to 12 prominent individuals. "
        "Also, evaluate if there is any structural hazard, scaffolding lean, tilt, or barricade collapse risk in the frame. "
        "Respond STRICTLY in JSON format. Do not include markdown codeblocks. The JSON object must match this schema:\n"
        "{\n"
        "  \"total_persons\": <int count of people, e.g., 65>,\n"
        "  \"density\": <estimated persons/m², float between 0.1 and 8.0>,\n"
        "  \"velocity_avg\": <estimated movement speed in pixels/frame, float between 0.2 and 5.0>,\n"
        "  \"pressure_score\": <estimated pressure between 0 and 100, int>,\n"
        "  \"risk_level\": <\"safe\" | \"moderate\" | \"high\" | \"critical\">,\n"
        "  \"overall_cri\": <estimated Crowd Risk Index between 0 and 100, int>,\n"
        "  \"safety_assessment\": <1-sentence description of safety context>,\n"
        "  \"scaffolding_hazard\": {\n"
        "    \"state\": <\"STATIC\" | \"MONITORING\" | \"ALERTING\" | \"CRITICAL\">,\n"
        "    \"displacement\": <displacement in pixels, float between 0.0 and 80.0>,\n"
        "    \"velocity\": <movement speed in px/frame, float between 0.0 and 5.0>,\n"
        "    \"severity\": <\"none\" | \"low\" | \"moderate\" | \"high\" | \"critical\">\n"
        "  },\n"
        "  \"detections\": [\n"
        "    {\n"
        "      \"bbox\": {\"x1\": <x1, int>, \"y1\": <y1, int>, \"x2\": <x2, int>, \"y2\": <y2, int>},\n"
        "      \"confidence\": <float between 0.5 and 0.99>,\n"
        "      \"track_id\": <unique int between 200 and 300>\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Assume image resolution is 1280x720. Bounding box coordinates must be integers in these bounds."
    )
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": base64_img
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    for current_model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=25)
            if response.status_code == 200:
                res_json = response.json()
                text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                text = text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                return json.loads(text)
            elif response.status_code == 429:
                print(f"Gemini frame analysis HTTP error 429 (Rate Limited) for model {current_model}: {response.text}")
                return {"rate_limited": True}
            else:
                print(f"Gemini frame analysis HTTP error {response.status_code} for model {current_model}: {response.text}")
        except Exception as e:
            print(f"Gemini frame analysis exception for model {current_model}: {str(e)}")
            
    return None

def resolve_api_key(body_key: str | None, x_key: str | None) -> str | None:
    if body_key and body_key.strip():
        return body_key.strip()
    if x_key and x_key.strip():
        return x_key.strip()
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    return None

# ─── Gemini AI Routes ──────────────────────────────────────────

@app.post("/api/v1/gemini/test")
async def gemini_test(req: GeminiTestRequest, x_gemini_key: str | None = Header(None)):
    key = resolve_api_key(req.api_key, x_gemini_key)
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required. Please set it in Settings.")
    
    res = call_gemini(
        api_key=key,
        model=req.model,
        system_instruction="You are a connection validator.",
        prompt="Hello, Gemini! Please verify if this connection is successful. Keep your answer under 5 words."
    )
    if "Error" in res or "Failed to connect" in res:
        raise HTTPException(status_code=400, detail=res)
    return {"status": "success", "message": res}

@app.post("/api/v1/gemini/copilot")
async def gemini_copilot(req: GeminiCopilotRequest, x_gemini_key: str | None = Header(None)):
    key = resolve_api_key(req.api_key, x_gemini_key)
    if not key:
        return {"reply": "Gemini API Key is not configured. Please set it up in the Settings page to chat with the Safety Copilot."}
    
    system_instruction = (
        "You are the CrowdShield AI Safety Assistant, an expert in crowd dynamics, crowd pressure, public safety, "
        "and emergency response. You analyze real-time crowd metrics and advise control center operators. "
        "Be professional, clear, concise, and highly actionable. Answer the user's question with direct reference "
        "to the provided real-time telemetry metrics."
    )
    
    metrics_context = ""
    if req.metrics:
        metrics_context = (
            f"Current Real-Time Metrics:\n"
            f"- Total Persons: {req.metrics.get('total_persons', 'N/A')}\n"
            f"- Crowd Density: {req.metrics.get('density', 'N/A')} persons/m²\n"
            f"- Average Velocity: {req.metrics.get('velocity', 'N/A')} px/frame\n"
            f"- Flow Consistency: {req.metrics.get('consistency', 'N/A')}%\n"
            f"- Estimated Pressure: {req.metrics.get('pressure', 'N/A')} / 100\n"
            f"- Overall Crowd Risk Index (CRI): {req.metrics.get('cri', 'N/A')}\n"
            f"- Risk Level: {req.metrics.get('risk_level', 'N/A')}\n\n"
        )
    
    prompt = (
        f"{metrics_context}"
        f"User Command/Question: {req.message}\n"
        f"Provide a structured, helpful safety assessment."
    )
    
    reply = call_gemini(key, req.model, system_instruction, prompt)
    return {"reply": reply}

@app.post("/api/v1/gemini/forecast")
async def gemini_forecast(req: GeminiForecastRequest, x_gemini_key: str | None = Header(None)):
    key = resolve_api_key(req.api_key, x_gemini_key)
    if not key:
        return {"reply": "Gemini API Key is not configured. Please set it up in the Settings page to generate AI projections."}
    
    system_instruction = (
        "You are a Spatio-Temporal Crowd Dynamics Forecaster. You analyze historical Crowd Risk Index (CRI) trends "
        "to project future risk patterns and draft actionable mitigation protocols."
    )
    
    prompt = (
        f"Here is the recent timeline of the Crowd Risk Index (CRI) values over the last 15 ticks:\n"
        f"{req.history}\n\n"
        f"Please analyze the trend (e.g. rising, falling, fluctuating, stabilizing) and write a spatio-temporal crowd safety assessment. "
        f"Format your response into three clean Markdown sections:\n"
        f"### Trend Analysis\n(Describe the trajectory of the CRI values)\n\n"
        f"### Potential Bottlenecks\n(Highlight what risks are likely to manifest based on the trend)\n\n"
        f"### Actionable Mitigations\n(Provide direct, numbered security and routing directives for ground control teams)"
    )
    
    reply = call_gemini(key, req.model, system_instruction, prompt)
    return {"reply": reply}

@app.post("/api/v1/gemini/hazard")
async def gemini_hazard(req: GeminiHazardRequest, x_gemini_key: str | None = Header(None)):
    key = resolve_api_key(req.api_key, x_gemini_key)
    if not key:
        return {"reply": "Gemini API Key is not configured. Please set it up in the Settings page to analyze hazard telemetry."}
    
    system_instruction = (
        "You are a Structural Safety Engineer. You evaluate structural movement telemetry "
        "(displacement, drift velocity, alarm severity) to identify collapse hazards and recommend emergency action plans."
    )
    
    prompt = (
        f"We have detected dynamic movement in a monitored scaffolding/barricade structure.\n"
        f"Structural Telemetry:\n"
        f"- Displacement: {req.displacement:.1f} pixels\n"
        f"- Drift Velocity: {req.velocity:.2f} px/frame\n"
        f"- Motion State: {req.state}\n"
        f"- Severity Level: {req.severity}\n\n"
        f"Analyze this telemetry and compile a structural risk advisory report with three clear Markdown sections:\n"
        f"### Structural Risk Assessment\n(Assess the stability, probability of collapse, and timeline concern)\n\n"
        f"### Failure Mode Prediction\n(Describe the mechanical mechanism of failure likely to happen)\n\n"
        f"### Emergency Action Plan\n(Detail direct step-by-step instructions for perimeter control, crowd diversion, and evacuation)"
    )
    
    reply = call_gemini(key, req.model, system_instruction, prompt)
    return {"reply": reply}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
