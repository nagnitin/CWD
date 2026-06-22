"""
Live Feed WebSocket — pushes real-time crowd metrics to connected clients.
Listens to Redis pub/sub to stream actual frame predictions, falling back to
simulated data when no active pipelines are running.
"""

import asyncio
import json
import time
import random
import math
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import ws_manager
from app.redis_client import get_redis

logger = logging.getLogger("crowdshield.ws.live_feed")
router = APIRouter()

# Global timestamp of the last real message processed to toggle simulation fallback
last_real_message_time = 0.0


def generate_simulated_metrics(frame: int) -> dict:
    """Generate simulated crowd metrics for demo purposes.
    Uses sinusoidal patterns to create realistic-looking data.
    """
    t = frame / 30.0  # Simulate 30fps timeline

    # Base crowd count with wave pattern
    base_count = 45 + 30 * math.sin(t * 0.1) + 15 * math.sin(t * 0.3)
    person_count = max(0, int(base_count + random.gauss(0, 5)))

    # Density follows count
    density = min(person_count / 100.0, 1.0) * 6.0  # persons/sq meter
    occupancy = min(person_count / 120.0, 1.0)

    # Velocity inversely related to density (crowd slows as density increases)
    base_velocity = max(0.5, 5.0 - density * 0.7)
    velocity = base_velocity + random.gauss(0, 0.3)

    # Flow consistency decreases with density
    flow_consistency = max(0.1, 1.0 - density * 0.12 + random.gauss(0, 0.05))

    # Pressure increases non-linearly with density
    pressure = min(100, (density ** 2) * 3.5 + random.gauss(0, 2))

    # CRI calculation
    density_norm = min(density / 6.0, 1.0) * 100
    growth_rate = max(0, (math.sin(t * 0.15) * 20 + random.gauss(0, 3)))
    speed_drop = max(0, (1.0 - velocity / 5.0) * 100)
    flow_conflict = max(0, min(100, random.gauss(20, 10) + density * 5))

    cri = (
        density_norm * 0.20
        + growth_rate * 0.15
        + speed_drop * 0.15
        + pressure * 0.20
        + flow_conflict * 0.15
        + (occupancy * 100) * 0.15
    )
    cri = max(0, min(100, cri))

    if cri <= 25:
        risk_level = "safe"
    elif cri <= 50:
        risk_level = "moderate"
    elif cri <= 75:
        risk_level = "high"
    else:
        risk_level = "critical"

    return {
        "type": "crowd_update",
        "frame_number": frame,
        "timestamp": round(t, 3),
        "total_persons": person_count,
        "overall_cri": round(cri, 1),
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
            "counter_flow_ratio": round(random.uniform(0, 0.3), 3),
        },
        "zones": [
            {
                "zone_id": f"zone_{i}",
                "person_count": max(0, int(person_count / 3 + random.gauss(0, 3))),
                "density": round(density * random.uniform(0.5, 1.5), 2),
                "risk_score": round(cri * random.uniform(0.6, 1.4), 1),
                "risk_level": risk_level,
            } for i in range(3)
        ],
    }


async def redis_broadcast_listener():
    """Background task to listen to Redis channels and broadcast to WebSockets."""
    global last_real_message_time
    
    while True:
        try:
            redis = await get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe("crowdshield:live_feed", "crowdshield:progress")
            logger.info("📡 Subscribed to Redis channels for real-time broadcasting")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    channel = message["channel"]
                    try:
                        data = json.loads(message["data"])
                        # Mark the time of the last real message
                        last_real_message_time = time.time()
                        
                        # Broadcast to all live_feed clients
                        await ws_manager.broadcast(data, "live_feed")
                    except Exception as ex:
                        logger.error(f"Error parsing or broadcasting message from {channel}: {ex}")
                        
        except asyncio.CancelledError:
            logger.info("Redis broadcast listener cancelled.")
            break
        except Exception as e:
            logger.error(f"Redis broadcast listener connection lost: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5.0)


@router.websocket("/ws/live")
async def live_feed(websocket: WebSocket):
    """WebSocket endpoint for real-time crowd metrics.
    Feeds real-time YOLO detections when active, otherwise runs demo simulation.
    """
    await ws_manager.connect(websocket, "live_feed")
    frame = 0

    try:
        while True:
            # Check for client messages (e.g., control commands)
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=0.05
                )
                msg = json.loads(data)
                # Handle client commands if any
            except asyncio.TimeoutError:
                pass

            # Push simulated metrics only if no real processing metrics are currently active
            now = time.time()
            if now - last_real_message_time > 2.0:
                metrics = generate_simulated_metrics(frame)
                await ws_manager.send_json(metrics, websocket)
                frame += 1
                await asyncio.sleep(0.1)  # ~10 updates/second
            else:
                # Sleep briefly to avoid high CPU usage during active streams
                await asyncio.sleep(0.05)

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, "live_feed")


@router.websocket("/ws/alerts")
async def alert_feed(websocket: WebSocket):
    """WebSocket endpoint for real-time alert notifications."""
    await ws_manager.connect(websocket, "alerts")

    try:
        while True:
            # Wait for messages from client (keepalive, acknowledgments)
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=5.0
                )
                msg = json.loads(data)
                # Handle client commands
                if msg.get("type") == "ping":
                    await ws_manager.send_json({"type": "pong"}, websocket)
            except asyncio.TimeoutError:
                # Send heartbeat
                await ws_manager.send_json(
                    {"type": "heartbeat", "timestamp": time.time()},
                    websocket,
                )

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, "alerts")
