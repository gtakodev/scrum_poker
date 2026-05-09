import { create } from "zustand";
import type { RoomState } from "@shared/types";

interface RoomStore {
  roomState: RoomState | null;
  sessionToken: string | null;
  myParticipantId: string | null;
  connected: boolean;
  error: string | null;

  setRoomState: (state: RoomState, sessionToken: string) => void;
  setMyParticipantId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>()((set) => ({
  roomState: null,
  sessionToken: null,
  myParticipantId: null,
  connected: false,
  error: null,

  setRoomState: (state, sessionToken) =>
    set({ roomState: state, sessionToken, error: null }),

  setMyParticipantId: (id) => set({ myParticipantId: id }),

  setConnected: (connected) => set({ connected }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      roomState: null,
      sessionToken: null,
      myParticipantId: null,
      connected: false,
      error: null,
    }),
}));
