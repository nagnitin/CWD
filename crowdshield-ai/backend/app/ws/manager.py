"""WebSocket Connection Manager — handles multiple concurrent connections."""

import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections with channel-based routing."""

    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = "default"):
        """Accept and register a WebSocket connection to a channel."""
        await websocket.accept()
        if channel not in self._connections:
            self._connections[channel] = set()
        self._connections[channel].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str = "default"):
        """Remove a WebSocket from a channel."""
        if channel in self._connections:
            self._connections[channel].discard(websocket)
            if not self._connections[channel]:
                del self._connections[channel]

    async def send_json(self, data: dict, websocket: WebSocket):
        """Send JSON data to a specific WebSocket."""
        try:
            await websocket.send_json(data)
        except Exception:
            pass

    async def broadcast(self, data: dict, channel: str = "default"):
        """Broadcast JSON data to all connections on a channel."""
        if channel not in self._connections:
            return

        disconnected = set()
        for ws in self._connections[channel]:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.add(ws)

        # Clean up disconnected sockets
        for ws in disconnected:
            self._connections[channel].discard(ws)

    async def broadcast_to_all(self, data: dict):
        """Broadcast to ALL channels."""
        for channel in list(self._connections.keys()):
            await self.broadcast(data, channel)

    @property
    def connection_count(self) -> int:
        """Total number of active connections."""
        return sum(len(conns) for conns in self._connections.values())

    @property
    def channel_info(self) -> dict:
        """Info about all channels and their connection counts."""
        return {ch: len(conns) for ch, conns in self._connections.items()}


# Global instance
ws_manager = ConnectionManager()
