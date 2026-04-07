import { randomUUID } from "crypto";
import { extractRows } from "@/app/api/_lib/db/shared";
import type { DatabaseResult } from "@/app/api/_lib/db";

interface SqlClient {
  query: (sql: string, params?: unknown[]) => Promise<DatabaseResult>;
}

export async function resolveAplusAppGroup(params: {
  sql: SqlClient;
  resourceLinkId: string;
  contextTitle: string | null;
  aplusGroup: string;
  userId: string;
  role: "instructor" | "member";
}) {
  const groupName = `A+ Group ${params.aplusGroup}`;
  const existingResult = await params.sql.query(
    `SELECT id, name
     FROM groups
     WHERE resource_link_id = $1
       AND name = $2
       AND created_by IS NULL
       AND COALESCE(lti_context_title, '') = COALESCE($3, '')
     ORDER BY created_at ASC
     LIMIT 1`,
    [params.resourceLinkId, groupName, params.contextTitle],
  );
  const existingRows = extractRows(existingResult) as Array<{ id: string; name: string }>;

  let resolvedGroup = existingRows[0] ?? null;
  if (!resolvedGroup) {
    const createResult = await params.sql.query(
      `INSERT INTO groups (name, join_key, lti_context_title, resource_link_id, created_by)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id, name`,
      [
        groupName,
        randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase(),
        params.contextTitle,
        params.resourceLinkId,
      ],
    );
    const createdRows = extractRows(createResult) as Array<{ id: string; name: string }>;
    resolvedGroup = createdRows[0] ?? null;
  }

  if (!resolvedGroup) {
    throw new Error("Failed to resolve A+ app group");
  }

  await params.sql.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
    [resolvedGroup.id, params.userId, params.role],
  );

  return {
    groupId: resolvedGroup.id,
    groupName: resolvedGroup.name,
  };
}
