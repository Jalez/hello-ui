import { NextResponse } from "next/server";

/**
 * University version: no billing. Return empty history for GET /api/stripe/subscriptions/history.
 */
export async function GET() {
  return NextResponse.json({ invoices: [] });
}
