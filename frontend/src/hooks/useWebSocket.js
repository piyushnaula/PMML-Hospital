import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

/**
 * Graceful WebSocket hook — connects only if VITE_WS_URL is configured.
 * On Render free tier, WS is not externally accessible, so this degrades
 * silently without breaking the app.
 */
export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const [connected, setConnected] = useState(false);

  // Keep a stable ref to the latest onMessage callback
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const send = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    // Skip if no WS URL configured (graceful degradation)
    if (!WS_URL) return;

    try {
      const socket = new WebSocket(WS_URL);
      ws.current = socket;

      socket.onopen = () => {
        retryCount.current = 0;
        setConnected(true);
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

      socket.onerror = () => {
        // Errors are handled in onclose — onerror always triggers onclose
      };

      socket.onclose = () => {
        setConnected(false);
        ws.current = null;

        // Auto-reconnect with limited retries
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          retryTimer.current = setTimeout(connect, RETRY_DELAY_MS);
        }
      };
    } catch (_) {
      // Silently fail — WS is an enhancement, not a requirement
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(retryTimer.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return { send, connected };
}
