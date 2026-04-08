import { NextResponse } from "next/server";

/**
 * GET /api/admin
 * Simple ping so admin API is reachable (e.g. with base path: /hello-ui/api/admin).
 * For admin check use: GET /api/admin/check-status (auth required).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Admin API. Use /api/admin/check-status for auth check.",
  });
}
