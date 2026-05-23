import type { ClientMessage } from "@shared/types";

let activeSocket: WebSocket | null = null;

export function bindRoomSocket(socket: WebSocket): void {
  activeSocket = socket;
}

export function unbindRoomSocket(socket?: WebSocket): void {
  if (!socket || activeSocket === socket) {
    activeSocket = null;
  }
}

export function sendRoomMessage(message: ClientMessage): boolean {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  activeSocket.send(JSON.stringify(message));
  return true;
}
