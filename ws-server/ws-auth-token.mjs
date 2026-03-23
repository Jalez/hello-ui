import jwt from "jsonwebtoken";

function getWsAuthSecret() {
  const secret =
    process.env.WS_AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV !== "production" ? "ws-auth-secret" : "");
  if (!secret) {
    throw new Error("WS auth secret is not configured");
  }
  return secret;
}

export function verifyWsAuthToken(token, { roomId } = {}) {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getWsAuthSecret(), {
      issuer: "ws-auth",
      audience: "ws-server",
    });

    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (roomId && payload.roomId !== roomId) {
      return null;
    }

    if (typeof payload.userId !== "string" || payload.userId.length === 0) {
      return null;
    }
    if (typeof payload.userEmail !== "string" || payload.userEmail.length === 0) {
      return null;
    }
    if (typeof payload.accountUserId !== "string" || payload.accountUserId.length === 0) {
      return null;
    }
    if (typeof payload.accountUserEmail !== "string" || payload.accountUserEmail.length === 0) {
      return null;
    }

    return {
      userId: payload.userId,
      userEmail: payload.userEmail,
      userName: typeof payload.userName === "string" ? payload.userName : undefined,
      userImage: typeof payload.userImage === "string" ? payload.userImage : undefined,
      accountUserId: payload.accountUserId,
      accountUserEmail: payload.accountUserEmail,
      roomId: payload.roomId,
      gameId: payload.gameId,
      authKind: payload.authKind,
    };
  } catch {
    return null;
  }
}

export const WS_AUTH_TOKEN_DOC = true;
