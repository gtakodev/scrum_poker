export const roomKeys = {
  exists: (roomId: string) => ["room-exists", roomId] as const,
  state: (roomId: string) => ["room-state", roomId] as const,
};
