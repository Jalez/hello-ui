-- DEPRECATED for new installs: versioned copy in lib/db/migrations/0000_game_runtime_drawboard_settings.sql.
-- Kept for reference / manual runs; Docker init no longer applies this file (use `pnpm db:migrate`).
--
-- Per-game drawboard capture and editor sync debounce (see game settings UI).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS drawboard_capture_mode TEXT NOT NULL DEFAULT 'browser'
    CHECK (drawboard_capture_mode IN ('browser', 'playwright')),
  ADD COLUMN IF NOT EXISTS manual_drawboard_capture BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_sync_debounce_ms INTEGER NOT NULL DEFAULT 500
    CHECK (remote_sync_debounce_ms >= 0 AND remote_sync_debounce_ms <= 10000);
