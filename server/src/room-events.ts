import type { RawData, WebSocket } from "ws";
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
} from "./room-store";
import { normalizeNonEmptyString } from "./validation";

export interface WSData {
  roomId: string;
  participantId: string | null;
  sessionToken: string | null;
}

type MessageValidationResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };

const SESSION_REPLACED_CLOSE_CODE = 4001;
const socketData = new WeakMap<WebSocket, WSData>();
const connections = new Map<string, Map<string, WebSocket>>();

function send(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseClientMessage(raw: RawData): MessageValidationResult {
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
    case "join":
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
    case "vote":
      if (typeof parsed.value !== "string") {
        return { ok: false, error: "Invalid vote payload" };
      }
      return { ok: true, message: { type: "vote", value: parsed.value } };
    case "reveal":
      return { ok: true, message: { type: "reveal" } };
    case "reset":
      return { ok: true, message: { type: "reset" } };
    case "kick":
      if (typeof parsed.participantId !== "string") {
        return { ok: false, error: "Invalid participantId" };
      }
      return {
        ok: true,
        message: { type: "kick", participantId: parsed.participantId },
      };
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

function sendRoomState(ws: WebSocket, roomId: string, participantId: string): void {
  const room = getRoom(roomId);
  const participant = room?.participants.get(participantId);
  if (!room || !participant) {
    return;
  }

  send(ws, {
    type: "room_state",
    state: buildRoomState(room, participantId),
    sessionToken: participant.sessionToken,
    yourParticipantId: participantId,
  });
}

function registerConnection(
  roomId: string,
  participantId: string,
  ws: WebSocket
): WebSocket | null {
  let roomConnections = connections.get(roomId);
  if (!roomConnections) {
    roomConnections = new Map();
    connections.set(roomId, roomConnections);
  }

  const previous = roomConnections.get(participantId) ?? null;
  roomConnections.set(participantId, ws);
  return previous === ws ? null : previous;
}

function unregisterConnection(roomId: string, participantId: string, ws?: WebSocket): boolean {
  const roomConnections = connections.get(roomId);
  if (!roomConnections) {
    return false;
  }

  const activeSocket = roomConnections.get(participantId);
  if (!activeSocket || (ws && activeSocket !== ws)) {
    return false;
  }

  roomConnections.delete(participantId);
  if (roomConnections.size === 0) {
    connections.delete(roomId);
  }

  return true;
}

function broadcastToRoom(roomId: string, excludedParticipantId?: string): void {
  const roomConnections = connections.get(roomId);
  if (!roomConnections) {
    return;
  }

  for (const [participantId, ws] of roomConnections) {
    if (participantId === excludedParticipantId) {
      continue;
    }

    sendRoomState(ws, roomId, participantId);
  }
}

export function attachSocketData(ws: WebSocket, data: WSData): void {
  socketData.set(ws, data);
}

export function handleMessage(ws: WebSocket, raw: RawData): void {
  const data = socketData.get(ws);
  if (!data) {
    send(ws, { type: "error", message: "Socket not initialized" });
    return;
  }

  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    send(ws, { type: "error", message: parsed.error });
    return;
  }

  const room = getRoom(data.roomId);
  const message = parsed.message;

  if (message.type === "join") {
    if (!room) {
      send(ws, { type: "error", message: "Room not found" });
      return;
    }

    const displayName = normalizeNonEmptyString(message.displayName);
    if (!displayName) {
      send(ws, { type: "error", message: "Display name is required" });
      return;
    }

    const result = addParticipant(room, displayName, message.sessionToken);
    data.participantId = result.participant.id;
    data.sessionToken = result.sessionToken;

    const previousSocket = registerConnection(data.roomId, result.participant.id, ws);
    if (previousSocket) {
      previousSocket.close(SESSION_REPLACED_CLOSE_CODE, "Session replaced by a newer tab");
    }

    sendRoomState(ws, data.roomId, result.participant.id);
    if (result.didChangeRoom) {
      broadcastToRoom(data.roomId, result.participant.id);
    }
    return;
  }

  if (!room || !data.participantId) {
    send(ws, { type: "error", message: "Not joined to a room" });
    return;
  }

  switch (message.type) {
    case "vote":
      if (!room.deck.includes(message.value)) {
        send(ws, { type: "error", message: "Invalid vote value" });
        return;
      }
      if (setVote(room, data.participantId, message.value)) {
        broadcastToRoom(data.roomId);
      }
      return;
    case "reveal":
      if (revealVotes(room)) {
        broadcastToRoom(data.roomId);
      }
      return;
    case "reset":
      if (resetVotes(room)) {
        broadcastToRoom(data.roomId);
      }
      return;
    case "kick":
      if (message.participantId === data.participantId) {
        send(ws, { type: "error", message: "Cannot kick yourself" });
        return;
      }

      const targetSocket = connections.get(data.roomId)?.get(message.participantId);
      if (targetSocket) {
        send(targetSocket, { type: "kicked" });
        unregisterConnection(data.roomId, message.participantId);
      }

      if (removeParticipant(room, message.participantId)) {
        broadcastToRoom(data.roomId);
      }
      return;
  }
}

export function handleClose(ws: WebSocket): void {
  const data = socketData.get(ws);
  if (!data?.participantId) {
    return;
  }

  const removed = unregisterConnection(data.roomId, data.participantId, ws);
  if (!removed) {
    return;
  }

  const room = getRoom(data.roomId);
  if (room && disconnectParticipant(room, data.participantId)) {
    broadcastToRoom(data.roomId);
  }
}
