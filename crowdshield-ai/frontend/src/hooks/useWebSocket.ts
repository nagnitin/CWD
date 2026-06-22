/* WebSocket hook for real-time data streaming */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE_URL } from '../config/api';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: any;
  send: (data: any) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  autoConnect = true,
  reconnectInterval = 3000,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const fullUrl = url.startsWith('ws') ? url : `${WS_BASE_URL}${url}`;
    const ws = new WebSocket(fullUrl);

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        onMessage?.(data);
      } catch {
        setLastMessage(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url, onMessage, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, []);

  return { isConnected, lastMessage, send, connect, disconnect };
}
