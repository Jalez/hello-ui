import type { GameAccessWindow } from "@/lib/gameAccessWindows";

export interface Game {
  id: string;
  user_id: string;
  map_name: string;
  title: string;
  description: string | null;
  progress_data: Record<string, unknown>;
  is_public: boolean;
  share_token: string | null;
  thumbnail_url: string | null;
  hide_sidebar: boolean;
  access_window_enabled: boolean;
  access_starts_at: Date | null;
  access_ends_at: Date | null;
  access_window_timezone: string | null;
  access_windows: GameAccessWindow[];
  access_key_required: boolean;
  access_key: string | null;
  collaboration_mode: "individual" | "group";
  /** Set when the game is bound to a collaboration group (see `projects.group_id`). */
  group_id: string | null;
  allow_duplicate_users: boolean;
  drawboard_capture_mode: "browser" | "playwright";
  manual_drawboard_capture: boolean;
  remote_sync_debounce_ms: number;
  drawboard_reload_debounce_ms: number;
  instance_purge_cadence: "daily" | "weekly" | "monthly" | null;
  instance_purge_timezone: string | null;
  instance_purge_hour: number | null;
  instance_purge_minute: number | null;
  instance_purge_weekday: number | null;
  instance_purge_day_of_month: number | null;
  instance_purge_last_executed_at: Date | null;
  is_owner?: boolean;
  is_collaborator?: boolean;
  can_edit?: boolean;
  can_manage_collaborators?: boolean;
  can_remove_collaborators?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGameOptions {
  userId: string;
  mapName?: string;
  title: string;
  progressData?: Record<string, unknown>;
}

export interface UpdateGameOptions {
  title?: string;
  description?: string | null;
  progressData?: Record<string, unknown>;
  isPublic?: boolean;
  shareToken?: string | null;
  thumbnailUrl?: string | null;
  hideSidebar?: boolean;
  accessWindowEnabled?: boolean;
  accessStartsAt?: Date | null;
  accessEndsAt?: Date | null;
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
  instancePurgeLastExecutedAt?: Date | null;
}

export interface GameCollaborator {
  user_id: string;
  added_by: string;
  created_at: Date;
}
