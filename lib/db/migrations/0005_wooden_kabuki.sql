ALTER TABLE "projects" ADD COLUMN "instance_purge_cadence" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_timezone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_hour" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_minute" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_weekday" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_day_of_month" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_purge_last_executed_at" timestamp with time zone;