import { useEffect, useRef, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8001";

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  // Keep a stable ref to the latest onMessage callback so the effect
  // does not need to re-run every time the parent re-renders.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const send = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      // Connection established — caller will send subscription message
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch (_) {
        // Ignore malformed messages
      }
    };

    socket.onerror = (e) => {
      console.error("WebSocket error", e);
    };

    socket.onclose = () => {
      // Connection closed — no auto-reconnect in prototype
    };

    return () => {
      socket.close();
    };
  }, []); // Run once on mount only

  return { send };
}
