import type { ServerWebSocket } from "bun";
import type { ClientMessage, ServerMessage } from "../../shared/types";
import {
  addParticipant,
  buildRoomState,
  disconnectParticipant,
  getRoom,
  removeParticipant,
  resetVotes,
  revealVotes,
  setVote,
} from "./room";
import { normalizeNonEmptyString } from "./validation";

// ─── Types ───────────────────────────────────────────────────
export interface WSData {
  roomId: string;
  participantId: string | null;
  sessionToken: string | null;
}

type MessageValidationResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };

const SESSION_REPLACED_CLOSE_CODE = 4001;

// ─── Helpers ─────────────────────────────────────────────────
function send(ws: ServerWebSocket<WSData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseClientMessage(raw: string | Buffer): MessageValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    return { ok: false, error: "Invalid message format" };
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return { ok: false, error: "Invalid message format" };
  }

  switch (parsed.type) {
    case "join": {
      if (typeof parsed.displayName !== "string") {
        return { ok: false, error: "Invalid display name" };
      }

      if (
        parsed.sessionToken !== undefined &&
        typeof parsed.sessionToken !== "string"
      ) {
        return { ok: false, error: "Invalid session token" };
      }

      return {
        ok: true,
        message: {
          type: "join",
          displayName: parsed.displayName,
          sessionToken: parsed.sessionToken,
        },
      };
    }

    case "vote": {
      if (typeof parsed.value !== "string") {
        return { ok: false, error: "Invalid vote payload" };
      }

      return {
        ok: true,
        message: { type: "vote", value: parsed.value },
      };
    }

    case "reveal":
      return { ok: true, message: { type: "reveal" } };

    case "reset":
      return { ok: true, message: { type: "reset" } };

    case "kick": {
      if (typeof parsed.participantId !== "string") {
        return { ok: false, error: "Invalid participantId" };
      }

      return {
        ok: true,
        message: { type: "kick", participantId: parsed.participantId },
      };
    }

    default:
      return { ok: false, error: "Unknown message type" };
  }
}

// Connection registry: roomId → Map<participantId, ws>
const connections = new Map<
  string,
  Map<string, ServerWebSocket<WSData>>
>();

function sendRoomState(
  ws: ServerWebSocket<WSData>,
  room: NonNullable<ReturnType<typeof getRoom>>,
  participantId: string
): void {
  const participant = room.participants.get(participantId);
  if (!participant) {
    return;
  }

  send(ws, {
    type: "room_state",
    state: buildRoomState(room, participantId),
    sessionToken: participant.sessionToken,
    yourParticipantId: participantId,
  });
}

export function registerConnection(
  roomId: string,
  participantId: string,
  ws: ServerWebSocket<WSData>
): ServerWebSocket<WSData> | null {
  let roomConns = connections.get(roomId);
  if (!roomConns) {
    roomConns = new Map();
    connections.set(roomId, roomConns);
  }

  const previous = roomConns.get(participantId) ?? null;
  roomConns.set(participantId, ws);
  return previous === ws ? null : previous;
}

export function unregisterConnection(
  roomId: string,
  participantId: string,
  ws?: ServerWebSocket<WSData>
): boolean {
  const roomConns = connections.get(roomId);
  if (!roomConns) {
    return false;
  }

  const activeWs = roomConns.get(participantId);
  if (!activeWs || (ws && activeWs !== ws)) {
    return false;
  }

  roomConns.delete(participantId);
  if (roomConns.size === 0) {
    connections.delete(roomId);
  }

  return true;
}

function broadcastToRoom(roomId: string, excludedParticipantId?: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  const roomConns = connections.get(roomId);
  if (!roomConns) return;

  for (const [pid, ws] of roomConns) {
    if (pid === excludedParticipantId) {
      continue;
    }

    sendRoomState(ws, room, pid);
  }
}

// ─── Message Handler ─────────────────────────────────────────
export function handleMessage(
  ws: ServerWebSocket<WSData>,
  raw: string | Buffer
): void {
  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    send(ws, { type: "error", message: parsed.error });
    return;
  }

  const msg = parsed.message;

  const { roomId } = ws.data;
  const room = getRoom(roomId);

  if (msg.type === "join") {
    if (!room) {
      send(ws, { type: "error", message: "Room not found" });
      return;
    }

    const displayName = normalizeNonEmptyString(msg.displayName);
    if (!displayName) {
      send(ws, { type: "error", message: "Display name is required" });
      return;
    }

    const { participant, sessionToken, didChangeRoom } = addParticipant(
      room,
      displayName,
      msg.sessionToken
    );

    ws.data.participantId = participant.id;
    ws.data.sessionToken = sessionToken;

    const previousWs = registerConnection(roomId, participant.id, ws);
    if (previousWs) {
      previousWs.close(
        SESSION_REPLACED_CLOSE_CODE,
        "Session replaced by a newer tab"
      );
    }

    sendRoomState(ws, room, participant.id);
    if (didChangeRoom) {
      broadcastToRoom(roomId, participant.id);
    }
    return;
  }

  // All other messages require an authenticated participant
  if (!ws.data.participantId || !room) {
    send(ws, { type: "error", message: "Not joined to a room" });
    return;
  }

  switch (msg.type) {
    case "vote": {
      if (!msg.value || !room.deck.includes(msg.value)) {
        send(ws, { type: "error", message: "Invalid vote value" });
        return;
      }

      if (!setVote(room, ws.data.participantId, msg.value)) {
        return;
      }

      broadcastToRoom(roomId);
      break;
    }

    case "reveal": {
      if (revealVotes(room)) {
        broadcastToRoom(roomId);
      }
      break;
    }

    case "reset": {
      if (resetVotes(room)) {
        broadcastToRoom(roomId);
      }
      break;
    }

    case "kick": {
      if (!msg.participantId) {
        send(ws, { type: "error", message: "Missing participantId" });
        return;
      }

      // Can't kick yourself
      if (msg.participantId === ws.data.participantId) {
        send(ws, { type: "error", message: "Cannot kick yourself" });
        return;
      }

      // Send kicked message to the target before removing
      const targetWs = connections.get(roomId)?.get(msg.participantId);
      if (targetWs) {
        send(targetWs, { type: "kicked" });
        unregisterConnection(roomId, msg.participantId);
      }

      if (removeParticipant(room, msg.participantId)) {
        broadcastToRoom(roomId);
      }
      break;
    }

    default: {
      send(ws, { type: "error", message: "Unknown message type" });
    }
  }
}

// ─── Disconnect Handler ──────────────────────────────────────
export function handleClose(ws: ServerWebSocket<WSData>): void {
  const { roomId, participantId } = ws.data;
  if (!roomId || !participantId) return;

  const removed = unregisterConnection(roomId, participantId, ws);
  if (!removed) {
    return;
  }

  const room = getRoom(roomId);
  if (room && disconnectParticipant(room, participantId)) {
    broadcastToRoom(roomId);
  }
}
