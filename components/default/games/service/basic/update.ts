import { apiUrl } from "@/lib/apiUrl";
import type { GameAccessWindow } from "@/lib/gameAccessWindows";
import type { Game } from "../../types";

export interface UpdateGameOptions {
  title?: string;
  description?: string | null;
  progressData?: Record<string, unknown>;
  isPublic?: boolean;
  shareToken?: string | null;
  thumbnailUrl?: string | null;
  hideSidebar?: boolean;
  accessWindowEnabled?: boolean;
  accessStartsAt?: string | null;
  accessEndsAt?: string | null;
  accessWindowTimezone?: string | null;
  accessWindows?: GameAccessWindow[];
  accessKeyRequired?: boolean;
  accessKey?: string | null;
  collaborationMode?: "individual" | "group";
  allowDuplicateUsers?: boolean;
  drawboardCaptureMode?: "browser" | "playwright";
  manualDrawboardCapture?: boolean;
  remoteSyncDebounceMs?: number;
  drawboardReloadDebounceMs?: number;
  instancePurgeCadence?: "daily" | "weekly" | "monthly" | null;
  instancePurgeTimezone?: string | null;
  instancePurgeHour?: number | null;
  instancePurgeMinute?: number | null;
  instancePurgeWeekday?: number | null;
  instancePurgeDayOfMonth?: number | null;
  instancePurgeLastExecutedAt?: string | null;
  regenerateAccessKey?: boolean;
  regenerateShareToken?: boolean;
}

export async function updateGame(id: string, updates: UpdateGameOptions): Promise<Game> {
  try {
    const response = await fetch(apiUrl(`/api/games/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Game not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      throw new Error(`Failed to update game: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to update game:", error);
    throw error;
  }
}
