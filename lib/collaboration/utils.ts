import { CURSOR_COLORS } from "./constants";

declare global {
  interface Window {
    __PLAYWRIGHT_WEBSOCKET_URL__?: string;
  }
}

export function generateClientId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

export function generateUserColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

export function isCursorValid(cursor: { x: number; y: number; ts: number }): boolean {
  if (typeof cursor.x !== "number" || typeof cursor.y !== "number") {
    return false;
  }
  if (isNaN(cursor.x) || isNaN(cursor.y)) {
    return false;
  }
  return true;
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  }) as T;
}

function normalizeSocketUrl(url: string): string {
  return url.replace("http://", "ws://").replace("https://", "wss://");
}

export function getWebSocketUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredUrl) {
    return normalizeSocketUrl(configuredUrl);
  }

  if (typeof window !== "undefined") {
    const playwrightOverride =
      window.__PLAYWRIGHT_WEBSOCKET_URL__
      || window.sessionStorage.getItem("__PLAYWRIGHT_WEBSOCKET_URL__")
      || "";
    if (playwrightOverride) {
      return normalizeSocketUrl(playwrightOverride);
    }

    const { protocol, hostname, origin } = window.location;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    if (isLocalhost) {
      return normalizeSocketUrl(`${protocol}//${hostname}:3100`);
    }

    return normalizeSocketUrl(`${origin}/css-artist-ws`);
  }

  return "ws://localhost:3100";
}

export function extractGroupIdFromRoomId(roomId: string | null | undefined): string | null {
  if (!roomId || !roomId.startsWith("group:")) {
    return null;
  }
  const afterPrefix = roomId.slice("group:".length);
  const gameSeparatorIndex = afterPrefix.indexOf(":game:");
  if (gameSeparatorIndex === -1) {
    return afterPrefix || null;
  }
  const groupId = afterPrefix.slice(0, gameSeparatorIndex);
  return groupId || null;
}

export function isLobbyRoom(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith("lobby:");
}
