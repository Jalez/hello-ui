-- Drop legacy map point columns removed from runtime map model.
ALTER TABLE maps DROP COLUMN IF EXISTS easy_level_points;
ALTER TABLE maps DROP COLUMN IF EXISTS medium_level_points;
ALTER TABLE maps DROP COLUMN IF EXISTS hard_level_points;
