-- Rename allow_duplicate_group_users -> allow_duplicate_users and change default to true.
-- Safe to run multiple times.

DO $$
BEGIN
  -- Only rename when the old column exists and the new name is not already taken.
  -- If both exist (e.g. partial migrations), drop the legacy column.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'allow_duplicate_group_users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'allow_duplicate_users'
    ) THEN
      ALTER TABLE projects RENAME COLUMN allow_duplicate_group_users TO allow_duplicate_users;
    ELSE
      ALTER TABLE projects DROP COLUMN allow_duplicate_group_users;
    END IF;
  END IF;

  -- Ensure the column exists (fresh installs get it from projects-schema.sql)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'allow_duplicate_users'
  ) THEN
    ALTER TABLE projects ADD COLUMN allow_duplicate_users BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Update the default to true for existing installations (no-op if column missing — skipped above)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'allow_duplicate_users'
  ) THEN
    ALTER TABLE projects ALTER COLUMN allow_duplicate_users SET DEFAULT true;
  END IF;
END$$;
