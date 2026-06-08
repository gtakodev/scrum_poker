import { nanoid } from "nanoid";
import { DEFAULT_DECK, type Participant, type RoomState } from "../../shared/types";

interface InternalParticipant {
  id: string;
  displayName: string;
  vote: string | null;
  connected: boolean;
  sessionToken: string;
  lastSeen: number;
}

export interface Room {
  id: string;
  name: string;
  deck: string[];
  revealed: boolean;
  participants: Map<string, InternalParticipant>;
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, Room>();
const sessionIndex = new Map<string, { roomId: string; participantId: string }>();

export function createRoom(name: string): Room {
  const room: Room = {
    id: nanoid(8),
    name,
    deck: [...DEFAULT_DECK],
    revealed: false,
    participants: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  rooms.set(room.id, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
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
  if (sessionToken) {
    const session = sessionIndex.get(sessionToken);
    if (session?.roomId === room.id) {
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

  const participant: InternalParticipant = {
    id: nanoid(10),
    displayName,
    vote: null,
    connected: true,
    sessionToken: nanoid(21),
    lastSeen: Date.now(),
  };

  room.participants.set(participant.id, participant);
  sessionIndex.set(participant.sessionToken, {
    roomId: room.id,
    participantId: participant.id,
  });
  room.lastActivity = Date.now();

  return {
    participant,
    sessionToken: participant.sessionToken,
    didChangeRoom: true,
  };
}

export function disconnectParticipant(room: Room, participantId: string): boolean {
  const participant = room.participants.get(participantId);
  if (!participant || !participant.connected) {
    return false;
  }

  participant.connected = false;
  participant.lastSeen = Date.now();
  room.lastActivity = Date.now();
  return true;
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

export function setVote(room: Room, participantId: string, value: string): boolean {
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

  for (const participant of room.participants.values()) {
    if (participant.vote !== null) {
      didChangeRoom = true;
    }
    participant.vote = null;
  }

  if (!didChangeRoom) {
    return false;
  }

  room.lastActivity = Date.now();
  return true;
}

export function buildRoomState(room: Room, forParticipantId: string): RoomState {
  const participants: Participant[] = [];

  for (const participant of room.participants.values()) {
    let vote: string | null = participant.vote;

    if (!room.revealed && participant.id !== forParticipantId) {
      vote = participant.vote !== null ? "hidden" : null;
    }

    participants.push({
      id: participant.id,
      displayName: participant.displayName,
      vote,
      connected: participant.connected,
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

const ROOM_TTL = 24 * 60 * 60 * 1000;
const DISCONNECT_TTL = 5 * 60 * 1000;

export function cleanup(): void {
  const now = Date.now();

  for (const [roomId, room] of rooms) {
    for (const [participantId, participant] of room.participants) {
      if (!participant.connected && now - participant.lastSeen > DISCONNECT_TTL) {
        sessionIndex.delete(participant.sessionToken);
        room.participants.delete(participantId);
      }
    }

    const isEmpty = room.participants.size === 0;
    const expired = now - room.lastActivity > ROOM_TTL;
    if (expired || (isEmpty && now - room.lastActivity > DISCONNECT_TTL)) {
      for (const participant of room.participants.values()) {
        sessionIndex.delete(participant.sessionToken);
      }
      rooms.delete(roomId);
    }
  }
}

export function resetStoreForTests(): void {
  rooms.clear();
  sessionIndex.clear();
}

setInterval(cleanup, 5 * 60 * 1000).unref();
