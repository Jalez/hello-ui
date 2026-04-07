import type { Game } from "@/components/default/games/types";
import { resolveManualDrawboardCapture } from "@/lib/gameRuntimeConfig";

/**
 * Prefer useGameRuntimeConfig().manualDrawboardCapture in React, or pass the current game.
 */
export function isManualDrawboardCaptureEnabled(
  game?: Pick<Game, "manualDrawboardCapture"> | null,
): boolean {
  return resolveManualDrawboardCapture(game ?? undefined);
}
