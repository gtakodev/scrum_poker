import type { Participant, RoomState } from "../../shared/types";
import { DEFAULT_DECK } from "../../shared/types";
import { nanoid } from "nanoid";

// ─── Internal Types ──────────────────────────────────────────
interface InternalParticipant {
  id: string;
  displayName: string;
  vote: string | null;
  connected: boolean;
  sessionToken: string;
  lastSeen: number;
}

interface Room {
  id: string;
  name: string;
  deck: string[];
  revealed: boolean;
  participants: Map<string, InternalParticipant>; // keyed by participant id
  createdAt: number;
  lastActivity: number;
}

// ─── Room Store ──────────────────────────────────────────────
const rooms = new Map<string, Room>();

// Map session tokens → { roomId, participantId } for reconnection
const sessionIndex = new Map<
  string,
  { roomId: string; participantId: string }
>();

export function createRoom(name: string): Room {
  const id = nanoid(8);
  const room: Room = {
    id,
    name,
    deck: [...DEFAULT_DECK],
    revealed: false,
    participants: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function addParticipant(
  room: Room,
  displayName: string,
  sessionToken?: string
): {
  participant: InternalParticipant;
  sessionToken: string;
  didChangeRoom: boolean;
} {
  // Try reconnection via session token
  if (sessionToken) {
    const session = sessionIndex.get(sessionToken);
    if (session && session.roomId === room.id) {
      const existing = room.participants.get(session.participantId);
      if (existing) {
        const didChangeRoom =
          !existing.connected || existing.displayName !== displayName;

        existing.connected = true;
        existing.displayName = displayName;
        existing.lastSeen = Date.now();
        room.lastActivity = Date.now();
        return { participant: existing, sessionToken, didChangeRoom };
      }
    }
  }

  // New participant
  const id = nanoid(10);
  const token = nanoid(21);
  const participant: InternalParticipant = {
    id,
    displayName,
    vote: null,
    connected: true,
    sessionToken: token,
    lastSeen: Date.now(),
  };

  room.participants.set(id, participant);
  sessionIndex.set(token, { roomId: room.id, participantId: id });
  room.lastActivity = Date.now();

  return { participant, sessionToken: token, didChangeRoom: true };
}

export function removeParticipant(room: Room, participantId: string): boolean {
  const participant = room.participants.get(participantId);
  if (!participant) {
    return false;
  }

  sessionIndex.delete(participant.sessionToken);
  room.participants.delete(participantId);
  room.lastActivity = Date.now();
  return true;
}

export function disconnectParticipant(
  room: Room,
  participantId: string
): boolean {
  const participant = room.participants.get(participantId);
  if (!participant || !participant.connected) {
    return false;
  }

  participant.connected = false;
  participant.lastSeen = Date.now();
  room.lastActivity = Date.now();
  return true;
}

export function setVote(
  room: Room,
  participantId: string,
  value: string
): boolean {
  const participant = room.participants.get(participantId);
  if (!participant || participant.vote === value) {
    return false;
  }

  participant.vote = value;
  room.lastActivity = Date.now();
  return true;
}

export function revealVotes(room: Room): boolean {
  if (room.revealed) {
    return false;
  }

  room.revealed = true;
  room.lastActivity = Date.now();
  return true;
}

export function resetVotes(room: Room): boolean {
  let didChangeRoom = room.revealed;

  room.revealed = false;
  for (const p of room.participants.values()) {
    if (p.vote !== null) {
      didChangeRoom = true;
    }
    p.vote = null;
  }

  if (!didChangeRoom) {
    return false;
  }

  room.lastActivity = Date.now();
  return true;
}

/**
 * Build the RoomState to send to a specific participant.
 * If not revealed, other participants' votes are masked as "hidden".
 */
export function buildRoomState(
  room: Room,
  forParticipantId: string
): RoomState {
  const participants: Participant[] = [];

  for (const p of room.participants.values()) {
    let vote: string | null = p.vote;

    // If not revealed and it's another participant, mask the vote
    if (!room.revealed && p.id !== forParticipantId) {
      vote = p.vote !== null ? "hidden" : null;
    }

    participants.push({
      id: p.id,
      displayName: p.displayName,
      vote,
      connected: p.connected,
    });
  }

  return {
    id: room.id,
    name: room.name,
    deck: room.deck,
    revealed: room.revealed,
    participants,
  };
}

// ─── Cleanup ─────────────────────────────────────────────────
const ROOM_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DISCONNECT_TTL = 5 * 60 * 1000; // 5 minutes

export function cleanup(): void {
  const now = Date.now();

  for (const [roomId, room] of rooms) {
    // Remove long-disconnected participants
    for (const [pid, p] of room.participants) {
      if (!p.connected && now - p.lastSeen > DISCONNECT_TTL) {
        sessionIndex.delete(p.sessionToken);
        room.participants.delete(pid);
      }
    }

    // Remove expired rooms (no activity for 24h or empty for 5min)
    const isEmpty = room.participants.size === 0;
    const expired = now - room.lastActivity > ROOM_TTL;
    if (expired || (isEmpty && now - room.lastActivity > DISCONNECT_TTL)) {
      // Clean up all session tokens for this room
      for (const p of room.participants.values()) {
        sessionIndex.delete(p.sessionToken);
      }
      rooms.delete(roomId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);
