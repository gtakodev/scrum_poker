import { createRoom, getRoom } from "./room";
import { handleClose, handleMessage, type WSData } from "./handlers";
import path from "path";
import { statSync, existsSync } from "fs";

const PORT = parseInt(process.env.PORT || "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_DIST = path.resolve(import.meta.dir, "../../client/dist");

// ─── MIME types for static file serving ──────────────────────
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

// ─── Serve static files (production) ─────────────────────────
function serveStatic(pathname: string): Response | null {
  if (!IS_PROD) return null;

  let filePath = path.join(CLIENT_DIST, pathname);

  // If it's a directory or no extension, serve index.html (SPA fallback)
  try {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": getMimeType(filePath) },
      });
    }
  } catch {
    // fall through
  }

  // SPA fallback — serve index.html for all non-API/non-WS routes
  const indexPath = path.join(CLIENT_DIST, "index.html");
  if (existsSync(indexPath)) {
    return new Response(Bun.file(indexPath), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return null;
}

// ─── Server ──────────────────────────────────────────────────
const server = Bun.serve<WSData>({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ── WebSocket upgrade ──
    if (pathname.startsWith("/ws/")) {
      const roomId = pathname.slice(4); // "/ws/abc123" → "abc123"
      const room = getRoom(roomId);
      if (!room) {
        return new Response(JSON.stringify({ error: "Room not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const success = server.upgrade(req, {
        data: { roomId, participantId: null, sessionToken: null } satisfies WSData,
      });
      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // ── API: Create room ──
    if (pathname === "/api/rooms" && req.method === "POST") {
      return (async () => {
        try {
          const body = (await req.json()) as { name?: string };
          const name = body.name?.trim();
          if (!name) {
            return new Response(
              JSON.stringify({ error: "Room name is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          const room = createRoom(name);
          return new Response(
            JSON.stringify({ roomId: room.id, name: room.name }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid request body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      })();
    }

    // ── API: Check room exists ──
    if (pathname.startsWith("/api/rooms/") && req.method === "GET") {
      const roomId = pathname.slice(11); // "/api/rooms/abc123" → "abc123"
      const room = getRoom(roomId);
      if (!room) {
        return new Response(
          JSON.stringify({ exists: false }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ exists: true, name: room.name }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Static files (production) ──
    const staticResponse = serveStatic(pathname);
    if (staticResponse) return staticResponse;

    // ── Fallback ──
    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(_ws) {
      // Connection opened, waiting for join message
    },
    message(ws, message) {
      handleMessage(ws, message as string);
    },
    close(ws) {
      handleClose(ws);
    },
    idleTimeout: 120,
    maxPayloadLength: 64 * 1024, // 64KB — more than enough for our messages
  },
});

console.log(`SprintVote server running on http://localhost:${server.port}`);
