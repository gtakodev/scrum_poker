import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { attachSocketData, handleClose, handleMessage } from "./room-events";
import { createRoom, getRoom } from "./room-store";
import { normalizeNonEmptyString } from "./validation";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.post("/api/rooms", (request, response) => {
    const name = normalizeNonEmptyString(request.body?.name);
    if (!name) {
      response.status(400).json({ error: "Room name is required" });
      return;
    }

    const room = createRoom(name);
    response.status(201).json({ roomId: room.id, name: room.name });
  });

  app.get("/api/rooms/:roomId", (request, response) => {
    const room = getRoom(request.params.roomId);
    if (!room) {
      response.status(404).json({ exists: false });
      return;
    }

    response.json({ exists: true, name: room.name });
  });

  app.use((error: Error, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Invalid request body" });
      return;
    }

    next(error);
  });

  return app;
}

export function createRealtimeServer() {
  const app = createApp();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/ws/")) {
      socket.destroy();
      return;
    }

    const roomId = url.pathname.slice("/ws/".length);
    if (!getRoom(roomId)) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      attachSocketData(ws, {
        roomId,
        participantId: null,
        sessionToken: null,
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
      ws.on("message", (message) => handleMessage(ws, message));
      ws.on("close", () => handleClose(ws));
    });
  });

  return { app, server, wss };
}

export async function startServer(port = Number(process.env.PORT ?? 3000)): Promise<Server> {
  const { server } = createRealtimeServer();
  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  const address = server.address() as AddressInfo | null;
  if (address) {
    console.log(`SprintVote server running on http://localhost:${address.port}`);
  }

  return server;
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntryPoint) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
