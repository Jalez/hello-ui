import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminAuth } from "@/app/api/_lib/middleware/admin";
import { getOrphanMapNames, purgeOrphanMaps } from "@/app/api/_lib/services/mapService";
import debug from "debug";

const logger = debug("ui_designer:api:maps:purge-orphans");

/**
 * GET /api/maps/purge-orphans
 * List map names that are not attached to any game (admin only).
 */
export const GET = withAdminAuth(async (_request: NextRequest, _context, _session?: Session) => {
  try {
    const names = await getOrphanMapNames();
    return NextResponse.json({ count: names.length, names });
  } catch (error: unknown) {
    logger("Error: %O", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to list orphan maps", error: message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/maps/purge-orphans
 * Delete all maps that are not used by any game (admin only).
 */
export const POST = withAdminAuth(async (_request: NextRequest, _context, _session?: Session) => {
  try {
    const result = await purgeOrphanMaps();
    logger("Purged %d orphan maps", result.deleted);
    return NextResponse.json({
      deleted: result.deleted,
      names: result.names,
    });
  } catch (error: unknown) {
    logger("Error: %O", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to purge orphan maps", error: message },
      { status: 500 }
    );
  }
});
