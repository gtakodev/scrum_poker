import { create } from "zustand";
import type { RoomState, ClientMessage } from "@shared/types";

interface RoomStore {
  // State
  roomState: RoomState | null;
  sessionToken: string | null;
  myParticipantId: string | null;
  connected: boolean;
  error: string | null;

  // WebSocket ref (not serialized, just stored for sending)
  ws: WebSocket | null;

  // Actions
  setRoomState: (state: RoomState, sessionToken: string) => void;
  setMyParticipantId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setWs: (ws: WebSocket | null) => void;
  sendMessage: (msg: ClientMessage) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>()((set, get) => ({
  roomState: null,
  sessionToken: null,
  myParticipantId: null,
  connected: false,
  error: null,
  ws: null,

  setRoomState: (state, sessionToken) =>
    set({ roomState: state, sessionToken, error: null }),

  setMyParticipantId: (id) => set({ myParticipantId: id }),

  setConnected: (connected) => set({ connected }),

  setError: (error) => set({ error }),

  setWs: (ws) => set({ ws }),

  sendMessage: (msg) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  reset: () =>
    set({
      roomState: null,
      sessionToken: null,
      myParticipantId: null,
      connected: false,
      error: null,
      ws: null,
    }),
}));
