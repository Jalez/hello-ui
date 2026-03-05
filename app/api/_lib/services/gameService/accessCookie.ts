import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

type AccessControlledGame = {
  id: string;
  access_key_required: boolean;
  access_key: string | null;
};

const ACCESS_COOKIE_PREFIX = "ui_designer_game_access_";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getAccessCookieSecret(): string {
  return process.env.GAME_ACCESS_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "ui-designer-dev-access-cookie-secret";
}

function getCookieName(gameId: string): string {
  return `${ACCESS_COOKIE_PREFIX}${gameId}`;
}

function signAccessCookie(gameId: string, accessKey: string): string {
  return createHmac("sha256", getAccessCookieSecret()).update(`${gameId}:${accessKey}`).digest("base64url");
}

function shouldUseSecureCookies(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getRawAccessKeyFromRequest(request: NextRequest): string | null {
  const queryValue = request.nextUrl.searchParams.get("key") || request.nextUrl.searchParams.get("accessKey");
  const headerValue = request.headers.get("x-access-key") || request.headers.get("x-game-access-key");
  return (queryValue || headerValue || "").trim() || null;
}

export function resolveAccessKeyForGame(request: NextRequest, game: AccessControlledGame): string | null {
  const explicitAccessKey = getRawAccessKeyFromRequest(request);
  if (explicitAccessKey) {
    return explicitAccessKey;
  }

  if (!game.access_key_required || !game.access_key) {
    return null;
  }

  const cookieValue = request.cookies.get(getCookieName(game.id))?.value;
  if (!cookieValue) {
    return null;
  }

  const expected = signAccessCookie(game.id, game.access_key);
  return safeEqual(cookieValue, expected) ? game.access_key : null;
}

export function attachGameAccessCookie(
  request: NextRequest,
  response: NextResponse,
  game: AccessControlledGame,
  rawAccessKeyFromRequest: string | null,
): void {
  if (!game.access_key_required || !game.access_key) {
    clearGameAccessCookie(request, response, game.id);
    return;
  }

  if (!rawAccessKeyFromRequest || rawAccessKeyFromRequest !== game.access_key) {
    return;
  }

  response.cookies.set(getCookieName(game.id), signAccessCookie(game.id, game.access_key), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearGameAccessCookie(request: NextRequest, response: NextResponse, gameId: string): void {
  response.cookies.set(getCookieName(gameId), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: 0,
  });
}
