-- DEPRECATED for new installs: lib/db/migrations/0001_projects_group_id_lti_credentials.sql (and Drizzle schema).
-- Kept for reference / manual runs; Docker init no longer applies this file (use `pnpm db:migrate`).
--
-- ============================================================================
-- GROUP GAME MIGRATION
-- ============================================================================
-- Adds group_id to projects so a single game can be shared by a group
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_group_id ON projects(group_id);
