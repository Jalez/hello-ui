-- ============================================================================
-- UI DESIGNER GAME STATISTICS SCHEMA
-- ============================================================================
-- Durable leaderboard and analytics tables for finished game attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES game_instances(id) ON DELETE SET NULL,
  user_id UUID,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('individual', 'group')),
  player_display_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_ms INTEGER,
  final_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER NOT NULL DEFAULT 0,
  accuracy_percent INTEGER NOT NULL DEFAULT 0,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  is_finished BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_attempt_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  level_index INTEGER NOT NULL,
  level_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER NOT NULL DEFAULT 0,
  accuracy_percent INTEGER NOT NULL DEFAULT 0,
  best_time_ms INTEGER,
  raw_best_time TEXT,
  difficulty TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_attempt_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  user_id UUID,
  display_name TEXT,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  paste_count INTEGER NOT NULL DEFAULT 0,
  large_paste_count INTEGER NOT NULL DEFAULT 0,
  focus_loss_count INTEGER NOT NULL DEFAULT 0,
  active_edit_ms INTEGER NOT NULL DEFAULT 0,
  edit_count INTEGER NOT NULL DEFAULT 0,
  reset_level_count INTEGER NOT NULL DEFAULT 0,
  reset_game_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_attempt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  user_id UUID,
  level_index INTEGER,
  event_type TEXT NOT NULL,
  event_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_attempts_game_id ON game_attempts(game_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_finished_at ON game_attempts(finished_at);
CREATE INDEX IF NOT EXISTS idx_game_attempts_game_score_time ON game_attempts(game_id, final_points, duration_ms);
CREATE INDEX IF NOT EXISTS idx_game_attempts_user_id ON game_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_group_id ON game_attempts(group_id);
CREATE INDEX IF NOT EXISTS idx_game_attempts_instance_id ON game_attempts(instance_id);

CREATE INDEX IF NOT EXISTS idx_game_attempt_levels_attempt_id ON game_attempt_levels(attempt_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_levels_level_index ON game_attempt_levels(level_index);

CREATE INDEX IF NOT EXISTS idx_game_attempt_participants_attempt_id ON game_attempt_participants(attempt_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_participants_user_id ON game_attempt_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_game_attempt_events_attempt_id ON game_attempt_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_events_user_id ON game_attempt_events(user_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_events_level_index ON game_attempt_events(level_index);

CREATE OR REPLACE FUNCTION update_game_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_attempts_updated_at_trigger ON game_attempts;
CREATE TRIGGER game_attempts_updated_at_trigger
  BEFORE UPDATE ON game_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_game_attempts_updated_at();

COMMENT ON TABLE game_attempts IS 'Normalized finished gameplay attempts used for leaderboards and creator analytics';
COMMENT ON TABLE game_attempt_levels IS 'Per-level scoring and timing snapshots for one finished attempt';
COMMENT ON TABLE game_attempt_participants IS 'Per-user contribution and telemetry rollups for one finished attempt';
COMMENT ON TABLE game_attempt_events IS 'Lightweight summarized telemetry events attached to finished attempts';
