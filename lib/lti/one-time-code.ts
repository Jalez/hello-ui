import { randomBytes } from "crypto";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StoredPayload {
  token: string;
  dest: string;
  expiresAt: number;
}

const store = new Map<string, StoredPayload>();

function prune(): void {
  const now = Date.now();
  for (const [code, payload] of store.entries()) {
    if (payload.expiresAt <= now) store.delete(code);
  }
}

/**
 * Create a one-time code that can be exchanged for the LTI sign-in token.
 * The token is never put in the URL; only the opaque code is.
 */
export function createOneTimeCode(token: string, dest: string): string {
  prune();
  const code = randomBytes(32).toString("hex");
  store.set(code, {
    token,
    dest,
    expiresAt: Date.now() + TTL_MS,
  });
  return code;
}

/**
 * Exchange a one-time code for the token and dest. Deletes the code (one-time use).
 * Returns null if code is missing, expired, or already used.
 */
export function consumeOneTimeCode(code: string): { token: string; dest: string } | null {
  prune();
  const payload = store.get(code);
  if (!payload || payload.expiresAt <= Date.now()) return null;
  store.delete(code);
  return { token: payload.token, dest: payload.dest };
}
