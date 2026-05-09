import { useEffect, useRef, useCallback } from "react";
import { useRoomStore } from "@/stores/useRoomStore";
import { bindRoomSocket, unbindRoomSocket } from "@/lib/roomSocket";
import type { ServerMessage } from "@shared/types";

const STORAGE_PREFIX = "sprintvote_session_";

function getSessionToken(roomId: string): string | undefined {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${roomId}`) || undefined;
  } catch {
    return undefined;
  }
}

function saveSessionToken(roomId: string, token: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, token);
  } catch {
    // localStorage unavailable
  }
}

export function useWebSocket(roomId: string | null, displayName: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);
  const shouldReconnectRef = useRef(true);

  const {
    setRoomState,
    setMyParticipantId,
    setConnected,
    setError,
    reset,
  } = useRoomStore();

  const connect = useCallback(() => {
    if (!roomId || !displayName || !mountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${roomId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    bindRoomSocket(ws);
    shouldReconnectRef.current = true;

    ws.onopen = () => {
      if (!mountedRef.current || wsRef.current !== ws) {
        ws.close();
        return;
      }

      setConnected(true);
      reconnectAttempts.current = 0;
      shouldReconnectRef.current = true;

      // Send join message
      const sessionToken = getSessionToken(roomId);
      ws.send(
        JSON.stringify({
          type: "join",
          displayName,
          sessionToken,
        })
      );
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || wsRef.current !== ws) return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "room_state": {
          setRoomState(msg.state, msg.sessionToken);
          setMyParticipantId(msg.yourParticipantId);
          saveSessionToken(roomId, msg.sessionToken);
          break;
        }
        case "error": {
          setError(msg.message);
          break;
        }
        case "kicked": {
          shouldReconnectRef.current = false;
          setError("You have been removed from the room");
          ws.close();
          break;
        }
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current || wsRef.current !== ws) {
        unbindRoomSocket(ws);
        return;
      }

      setConnected(false);
      unbindRoomSocket(ws);
      wsRef.current = null;

      // Auto-reconnect with exponential backoff (max 3 attempts)
      if (!shouldReconnectRef.current) {
        return;
      }

      if (reconnectAttempts.current < 3) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 8000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      } else {
        setError("Connection lost. Please refresh to reconnect.");
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, handling reconnect
    };
  }, [roomId, displayName, setRoomState, setMyParticipantId, setConnected, setError]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        unbindRoomSocket(wsRef.current);
        wsRef.current.close();
        wsRef.current = null;
      }
      reset();
    };
  }, [connect, reset]);
}
