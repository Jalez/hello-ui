import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import {
  clearAllTourSpotAcksForUser,
  getTourSpotAcksForUser,
  upsertTourSpotAcksBatch,
} from "@/app/api/_lib/services/tourSpotAckService";
import { isTourSpotKey } from "@/lib/tour/tourSpotVersions";

export const GET = withAuth(async (_request: NextRequest, _context: unknown, session) => {
  const user = await getOrCreateUserByEmail(session!.user!.email);
  const acks = await getTourSpotAcksForUser(user.id);
  return NextResponse.json({ acks });
});

type PatchBody = {
  acks?: Record<string, number>;
};

export const PATCH = withAuth(async (request: NextRequest, _context: unknown, session) => {
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const acks = body.acks;
  if (!acks || typeof acks !== "object" || Array.isArray(acks)) {
    return NextResponse.json({ error: "Expected body: { acks: Record<string, number> }" }, { status: 400 });
  }
  for (const key of Object.keys(acks)) {
    if (!isTourSpotKey(key)) {
      return NextResponse.json({ error: `Unknown tour spot key: ${key}` }, { status: 400 });
    }
  }
  const user = await getOrCreateUserByEmail(session!.user!.email);
  try {
    await upsertTourSpotAcksBatch(user.id, acks);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (_request: NextRequest, _context: unknown, session) => {
  const user = await getOrCreateUserByEmail(session!.user!.email);
  try {
    await clearAllTourSpotAcksForUser(user.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});
