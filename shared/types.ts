// ─── Card Deck ───────────────────────────────────────────────
export const DEFAULT_DECK = [
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "100",
  "?",
  "☕",
] as const;

export type CardValue = (typeof DEFAULT_DECK)[number];

// ─── Room State (server → client) ───────────────────────────
export interface Participant {
  id: string;
  displayName: string;
  /** Actual value if revealed or own vote; "hidden" if not revealed & another player; null if no vote */
  vote: string | null;
  connected: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  deck: string[];
  revealed: boolean;
  participants: Participant[];
}

// ─── Client → Server Messages ───────────────────────────────
export type ClientMessage =
  | { type: "join"; displayName: string; sessionToken?: string }
  | { type: "vote"; value: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "kick"; participantId: string };

// ─── Server → Client Messages ───────────────────────────────
export type ServerMessage =
  | { type: "room_state"; state: RoomState; sessionToken: string; yourParticipantId: string }
  | { type: "error"; message: string }
  | { type: "kicked" };
