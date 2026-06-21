import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomState, ServerMessage } from "@shared/types";
import { getSessionToken, saveSessionToken } from "@/lib/storage";
import { roomKeys } from "./query-keys";

export interface RoomSocketState {
  connected: boolean;
  error: string | null;
  myParticipantId: string | null;
  sendMessage: (message: ClientMessage) => boolean;
}

export function useRoomSocket(
  roomId: string | null,
  displayName: string | null
): RoomSocketState {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const connect = useCallback(() => {
    if (!roomId || !displayName || !mountedRef.current) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}`);
    wsRef.current = ws;
    shouldReconnectRef.current = true;

    ws.onopen = () => {
      if (!mountedRef.current || wsRef.current !== ws) {
        ws.close();
        return;
      }

      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      ws.send(
        JSON.stringify({
          type: "join",
          displayName,
          sessionToken: getSessionToken(roomId),
        } satisfies ClientMessage)
      );
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || wsRef.current !== ws) {
        return;
      }

      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case "room_state":
          queryClient.setQueryData<RoomState | null>(
            roomKeys.state(roomId),
            message.state
          );
          saveSessionToken(roomId, message.sessionToken);
          setMyParticipantId(message.yourParticipantId);
          setError(null);
          return;
        case "error":
          setError(message.message);
          return;
        case "kicked":
          shouldReconnectRef.current = false;
          setError("You have been removed from the room");
          ws.close();
          return;
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current || wsRef.current !== ws) {
        return;
      }

      setConnected(false);
      wsRef.current = null;

      if (!shouldReconnectRef.current) {
        return;
      }

      if (reconnectAttempts.current < 3) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 8000);
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      } else {
        setError("Connection lost. Please refresh to reconnect.");
      }
    };
  }, [displayName, queryClient, roomId]);

  useEffect(() => {
    mountedRef.current = true;

    if (roomId) {
      queryClient.setQueryData<RoomState | null>(roomKeys.state(roomId), null);
    }

    if (roomId && displayName) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      setConnected(false);
      setError(null);
      setMyParticipantId(null);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (roomId) {
        queryClient.setQueryData<RoomState | null>(roomKeys.state(roomId), null);
      }
    };
  }, [connect, displayName, queryClient, roomId]);

  return { connected, error, myParticipantId, sendMessage };
}
