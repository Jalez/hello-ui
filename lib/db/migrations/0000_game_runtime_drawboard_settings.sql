-- Per-game drawboard capture and editor sync debounce (see creator game settings).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS drawboard_capture_mode TEXT NOT NULL DEFAULT 'browser'
    CHECK (drawboard_capture_mode IN ('browser', 'playwright')),
  ADD COLUMN IF NOT EXISTS manual_drawboard_capture BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_sync_debounce_ms INTEGER NOT NULL DEFAULT 500
    CHECK (remote_sync_debounce_ms >= 0 AND remote_sync_debounce_ms <= 10000);
