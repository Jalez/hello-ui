-- ============================================================================
-- GAME INSTANCES MIGRATION
-- Adds instance-scoped runtime progress table for individual/group gameplay.
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('individual', 'group')),
  user_id TEXT,
  group_id UUID,
  progress_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE game_instances
  DROP CONSTRAINT IF EXISTS game_instances_scope_targets_chk;

ALTER TABLE game_instances
  ADD CONSTRAINT game_instances_scope_targets_chk CHECK (
    (scope = 'individual' AND user_id IS NOT NULL AND group_id IS NULL) OR
    (scope = 'group' AND group_id IS NOT NULL AND user_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_instances_individual_unique
  ON game_instances(game_id, user_id)
  WHERE scope = 'individual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_instances_group_unique
  ON game_instances(game_id, group_id)
  WHERE scope = 'group';

CREATE INDEX IF NOT EXISTS idx_game_instances_game_id ON game_instances(game_id);
CREATE INDEX IF NOT EXISTS idx_game_instances_group_id ON game_instances(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_instances_user_id ON game_instances(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_instances_updated_at ON game_instances(updated_at);

CREATE OR REPLACE FUNCTION update_game_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_instances_updated_at_trigger ON game_instances;
CREATE TRIGGER game_instances_updated_at_trigger
  BEFORE UPDATE ON game_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_game_instances_updated_at();
