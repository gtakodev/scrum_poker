export interface CreateRoomResponse {
  roomId: string;
  name: string;
}

export interface RoomExistsResponse {
  exists: boolean;
  name?: string;
}

export async function createRoom(name: string): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create room");
  }

  return response.json();
}

export async function getRoom(roomId: string): Promise<RoomExistsResponse> {
  const response = await fetch(`/api/rooms/${roomId}`);

  if (response.status === 404) {
    return { exists: false };
  }

  if (!response.ok) {
    throw new Error("Failed to fetch room");
  }

  return response.json();
}
