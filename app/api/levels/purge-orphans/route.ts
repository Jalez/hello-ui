import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";
import { getOrphanLevelIdentifiers, purgeOrphanLevels } from "@/app/api/_lib/services/levelService";
import debug from "debug";

const logger = debug("ui_designer:api:levels:purge-orphans");

/**
 * GET /api/levels/purge-orphans
 * List level identifiers that are not attached to any map (admin only).
 */
export const GET = withAdminAuth(async (_request: NextRequest, _context, _session?: Session) => {
  try {
    const identifiers = await getOrphanLevelIdentifiers();
    return NextResponse.json({ count: identifiers.length, identifiers });
  } catch (error: unknown) {
    logger("Error: %O", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to list orphan levels", error: message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/levels/purge-orphans
 * Delete all levels that are not part of any map (admin only).
 */
export const POST = withAdminAuth(async (_request: NextRequest, _context, _session?: Session) => {
  try {
    const result = await purgeOrphanLevels();
    logger("Purged %d orphan levels", result.deleted);
    return NextResponse.json({
      deleted: result.deleted,
      identifiers: result.identifiers,
    });
  } catch (error: unknown) {
    logger("Error: %O", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to purge orphan levels", error: message },
      { status: 500 }
    );
  }
});
