import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { and, asc, ilike, notInArray, or } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getGameById, listCollaborators } from "@/app/api/_lib/services/gameService";
import { getUserByEmail } from "@/app/api/_lib/services/userService";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const { id } = await params;

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_manage_collaborators) {
    return NextResponse.json({ error: "Only creators can search collaborators" }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const collaborators = await listCollaborators(id);
  const ownerUser = game.user_id.includes("@") ? { email: game.user_id } : await getUserByEmail(game.user_id);

  const excludedEmails = new Set<string>();
  for (const collaborator of collaborators) {
    if (collaborator.user_id.includes("@")) {
      excludedEmails.add(collaborator.user_id.toLowerCase());
    }
  }
  if (ownerUser?.email) {
    excludedEmails.add(ownerUser.email.toLowerCase());
  }
  if (session.user.email) {
    excludedEmails.add(session.user.email.toLowerCase());
  }

  const db = getDb();
  const pattern = `%${q}%`;
  const baseWhere = or(ilike(users.email, pattern), ilike(users.name, pattern));

  const whereClause =
    excludedEmails.size > 0
      ? and(baseWhere, notInArray(users.email, Array.from(excludedEmails)))
      : baseWhere;

  const rows = await db
    .select({
      email: users.email,
      name: users.name
    })
    .from(users)
    .where(whereClause)
    .orderBy(asc(users.email))
    .limit(MAX_RESULTS);

  return NextResponse.json({
    suggestions: rows.map((row) => ({
      email: row.email,
      name: row.name
    }))
  });
}
