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

// ─── Types ───────────────────────────────────────────────────
export interface WSData {
  roomId: string;
  participantId: string | null;
  sessionToken: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────
function send(ws: ServerWebSocket<WSData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function broadcastRoomState(
  server: { publish: (topic: string, data: string) => void },
  roomId: string
): void {
  const room = getRoom(roomId);
  if (!room) return;

  // We need to send personalized state to each participant (their own vote visible, others hidden).
  // Bun's pub/sub sends the same message to everyone. So we iterate and send individually.
  // This is fine for <20 participants.
  // We'll rely on the per-connection send in the callers instead.
}

/**
 * Broadcast room state to all connected WebSocket clients in a room.
 * Since each participant gets a personalized view (their own vote visible),
 * we can't use Bun's pub/sub topic broadcast. Instead, the server instance
 * tracks connections and we publish a "trigger" message.
 */

// Connection registry: roomId → Map<participantId, ws>
const connections = new Map<
  string,
  Map<string, ServerWebSocket<WSData>>
>();

export function registerConnection(
  roomId: string,
  participantId: string,
  ws: ServerWebSocket<WSData>
): void {
  let roomConns = connections.get(roomId);
  if (!roomConns) {
    roomConns = new Map();
    connections.set(roomId, roomConns);
  }
  roomConns.set(participantId, ws);
}

export function unregisterConnection(
  roomId: string,
  participantId: string
): void {
  const roomConns = connections.get(roomId);
  if (roomConns) {
    roomConns.delete(participantId);
    if (roomConns.size === 0) {
      connections.delete(roomId);
    }
  }
}

function broadcastToRoom(roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;

  const roomConns = connections.get(roomId);
  if (!roomConns) return;

  for (const [pid, ws] of roomConns) {
    const participant = room.participants.get(pid);
    if (!participant) continue;

    const state = buildRoomState(room, pid);
    send(ws, {
      type: "room_state",
      state,
      sessionToken: participant.sessionToken,
      yourParticipantId: pid,
    });
  }
}

// ─── Message Handler ─────────────────────────────────────────
export function handleMessage(
  ws: ServerWebSocket<WSData>,
  raw: string | Buffer
): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    send(ws, { type: "error", message: "Invalid message format" });
    return;
  }

  const { roomId } = ws.data;
  const room = getRoom(roomId);

  if (msg.type === "join") {
    if (!room) {
      send(ws, { type: "error", message: "Room not found" });
      return;
    }

    const displayName = msg.displayName?.trim();
    if (!displayName) {
      send(ws, { type: "error", message: "Display name is required" });
      return;
    }

    const { participant, sessionToken } = addParticipant(
      room,
      displayName,
      msg.sessionToken
    );

    ws.data.participantId = participant.id;
    ws.data.sessionToken = sessionToken;

    registerConnection(roomId, participant.id, ws);
    broadcastToRoom(roomId);
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
      setVote(room, ws.data.participantId, msg.value);
      broadcastToRoom(roomId);
      break;
    }

    case "reveal": {
      revealVotes(room);
      broadcastToRoom(roomId);
      break;
    }

    case "reset": {
      resetVotes(room);
      broadcastToRoom(roomId);
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

      removeParticipant(room, msg.participantId);
      broadcastToRoom(roomId);
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

  const room = getRoom(roomId);
  if (room) {
    disconnectParticipant(room, participantId);
    unregisterConnection(roomId, participantId);
    broadcastToRoom(roomId);
  }
}
