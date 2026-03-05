import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import { isAdmin, isAdminByEmail } from "@/app/api/_lib/services/adminService";

/**
 * GET /api/admin/check-status
 * Returns whether the current user is an admin (auth required).
 * Uses email (case-insensitive) first so seeded admin matches regardless of casing.
 * In development, also returns debug info to verify session (email, hasUserId).
 */
export const GET = withAuth(async (_request: NextRequest, _context, session?: Session) => {
  let admin = false;
  if (session?.user?.email) {
    admin = await isAdminByEmail(session.user.email);
  }
  if (!admin && session?.userId) {
    admin = await isAdmin(session.userId);
  }
  const body: { isAdmin: boolean; debug?: { email: string; hasUserId: boolean } } = { isAdmin: admin };
  if (process.env.NODE_ENV === "development") {
    body.debug = {
      email: session?.user?.email ?? "(none)",
      hasUserId: Boolean(session?.userId),
    };
  }
  return NextResponse.json(body);
});
