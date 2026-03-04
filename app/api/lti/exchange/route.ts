import { NextRequest, NextResponse } from "next/server";
import { consumeOneTimeCode } from "@/lib/lti/one-time-code";

/**
 * POST /api/lti/exchange
 * Exchange a one-time code (from the LTI login redirect URL) for the sign-in token.
 * The token is never in the URL; only the opaque code is. Code is single-use and short-lived.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code.trim() : null;
    if (!code) {
      return NextResponse.json({ error: "Missing or invalid code" }, { status: 400 });
    }

    const payload = consumeOneTimeCode(code);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please try signing in again from the LMS." },
        { status: 400 }
      );
    }

    return NextResponse.json({ token: payload.token, dest: payload.dest });
  } catch {
    return NextResponse.json({ error: "Exchange failed" }, { status: 500 });
  }
}
