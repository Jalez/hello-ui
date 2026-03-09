"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS game_attempts (
        id uuid PRIMARY KEY,
        game_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        instance_id uuid REFERENCES game_instances(id) ON DELETE SET NULL,
        user_id uuid,
        group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
        scope text NOT NULL,
        player_display_name text,
        started_at timestamptz,
        finished_at timestamptz NOT NULL,
        duration_ms integer,
        final_points integer NOT NULL DEFAULT 0,
        max_points integer NOT NULL DEFAULT 0,
        accuracy_percent integer NOT NULL DEFAULT 0,
        attempt_number integer NOT NULL DEFAULT 1,
        is_finished boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_attempt_levels (
        id uuid PRIMARY KEY,
        attempt_id uuid NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
        level_index integer NOT NULL,
        level_name text NOT NULL,
        points integer NOT NULL DEFAULT 0,
        max_points integer NOT NULL DEFAULT 0,
        accuracy_percent integer NOT NULL DEFAULT 0,
        best_time_ms integer,
        raw_best_time text,
        difficulty text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_attempt_participants (
        id uuid PRIMARY KEY,
        attempt_id uuid NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
        user_id uuid,
        display_name text,
        contribution_score integer NOT NULL DEFAULT 0,
        paste_count integer NOT NULL DEFAULT 0,
        large_paste_count integer NOT NULL DEFAULT 0,
        focus_loss_count integer NOT NULL DEFAULT 0,
        active_edit_ms integer NOT NULL DEFAULT 0,
        edit_count integer NOT NULL DEFAULT 0,
        reset_level_count integer NOT NULL DEFAULT 0,
        reset_game_count integer NOT NULL DEFAULT 0,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_attempt_events (
        id uuid PRIMARY KEY,
        attempt_id uuid NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
        user_id uuid,
        level_index integer,
        event_type text NOT NULL,
        event_value jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
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
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS game_attempt_events;
      DROP TABLE IF EXISTS game_attempt_participants;
      DROP TABLE IF EXISTS game_attempt_levels;
      DROP TABLE IF EXISTS game_attempts;
    `);
  },
};
