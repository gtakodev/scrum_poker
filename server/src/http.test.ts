import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { resetStoreForTests } from "./room-store";
import { startServer } from "./index";

describe("server http api", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    resetStoreForTests();
    server = await startServer(0);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Server did not expose a port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("creates and retrieves a room", async () => {
    const createResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sprint 42" }),
    });

    expect(createResponse.status).toBe(201);
    const createBody = (await createResponse.json()) as {
      roomId: string;
      name: string;
    };
    expect(createBody.name).toBe("Sprint 42");
    expect(createBody.roomId).toEqual(expect.any(String));

    const getResponse = await fetch(`${baseUrl}/api/rooms/${createBody.roomId}`);
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      exists: true,
      name: "Sprint 42",
    });
  });

  it("rejects invalid room names and malformed json payloads", async () => {
    const invalidNameResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    expect(invalidNameResponse.status).toBe(400);
    await expect(invalidNameResponse.json()).resolves.toEqual({
      error: "Room name is required",
    });

    const invalidJsonResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });

    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toEqual({
      error: "Invalid request body",
    });
  });
});
