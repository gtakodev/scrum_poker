const DISPLAY_NAME_PREFIX = "sprintvote_name_";
const SESSION_PREFIX = "sprintvote_session_";

export function getDisplayName(roomId: string): string {
  try {
    return sessionStorage.getItem(`${DISPLAY_NAME_PREFIX}${roomId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveDisplayName(roomId: string, displayName: string): void {
  try {
    sessionStorage.setItem(`${DISPLAY_NAME_PREFIX}${roomId}`, displayName);
  } catch {
    // Storage may be unavailable.
  }
}

export function getSessionToken(roomId: string): string | undefined {
  try {
    return localStorage.getItem(`${SESSION_PREFIX}${roomId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveSessionToken(roomId: string, sessionToken: string): void {
  try {
    localStorage.setItem(`${SESSION_PREFIX}${roomId}`, sessionToken);
  } catch {
    // Storage may be unavailable.
  }
}
