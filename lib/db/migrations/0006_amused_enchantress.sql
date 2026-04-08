ALTER TABLE "projects" ADD COLUMN "access_window_timezone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "access_windows" jsonb DEFAULT '[]'::jsonb NOT NULL;