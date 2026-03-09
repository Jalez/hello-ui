import { type NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";
import { addAdmin, removeAdmin } from "@/app/api/_lib/services/adminService";
import { extractRows, getSqlInstance } from "@/app/api/_lib/db/shared";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  is_admin: boolean;
  admin_role: string | null;
  granted_at: string | Date | null;
  granted_by_email: string | null;
};

export const GET = withAdminAuth(async (_request: NextRequest, _context, session) => {
  const sql = await getSqlInstance();
  const result = await sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.created_at,
      u.updated_at,
      COALESCE(ar.is_active, false) AS is_admin,
      ar.role AS admin_role,
      ar.granted_at,
      granter.email AS granted_by_email
    FROM users u
    LEFT JOIN admin_roles ar ON ar.user_id = u.id AND ar.is_active = true
    LEFT JOIN users granter ON granter.id = ar.granted_by
    ORDER BY
      COALESCE(ar.is_active, false) DESC,
      u.created_at DESC,
      LOWER(TRIM(u.email)) ASC
  `;

  const users = extractRows(result) as AdminUserRow[];
  return NextResponse.json({
    currentUserId: session?.userId ?? null,
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      isAdmin: user.is_admin,
      adminRole: user.admin_role,
      grantedAt: user.granted_at,
      grantedByEmail: user.granted_by_email,
    })),
  });
});

export const PATCH = withAdminAuth(async (request: NextRequest, _context, session) => {
  const body = (await request.json().catch(() => null)) as
    | { userId?: string; makeAdmin?: boolean; role?: string }
    | null;

  if (!body?.userId || typeof body.makeAdmin !== "boolean") {
    return NextResponse.json({ error: "userId and makeAdmin are required" }, { status: 400 });
  }

  if (!body.makeAdmin && session?.userId && body.userId === session.userId) {
    return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 });
  }

  const sql = await getSqlInstance();
  const existingUserResult = await sql`
    SELECT id
    FROM users
    WHERE id = ${body.userId}
    LIMIT 1
  `;
  const existingUsers = extractRows(existingUserResult) as Array<{ id: string }>;
  if (existingUsers.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const success = body.makeAdmin
    ? await addAdmin(body.userId, body.role || "admin", session?.userId)
    : await removeAdmin(body.userId);

  if (!success) {
    return NextResponse.json(
      { error: body.makeAdmin ? "Failed to grant admin access" : "Failed to remove admin access" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
});
