ALTER TABLE "projects" ADD COLUMN "instance_retention_hours" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "instance_retention_anchor_at" timestamp with time zone;--> statement-breakpoint
