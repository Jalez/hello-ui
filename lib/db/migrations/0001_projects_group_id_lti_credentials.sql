-- Link games to collaboration groups + LTI credential store (parity with legacy scripts/sql).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "group_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_group_id_groups_id_fk'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_group_id_groups_id_fk"
      FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_group_id" ON "projects" USING btree ("group_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "consumer_key" text NOT NULL,
  "consumer_secret" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lti_credentials_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "lti_credentials_consumer_key_key" UNIQUE ("consumer_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lti_credentials_consumer_key" ON "lti_credentials" USING btree ("consumer_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lti_credentials_user_id" ON "lti_credentials" USING btree ("user_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_lti_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lti_credentials_updated_at_trigger ON lti_credentials;
--> statement-breakpoint
CREATE TRIGGER lti_credentials_updated_at_trigger
  BEFORE UPDATE ON lti_credentials
  FOR EACH ROW
  EXECUTE PROCEDURE update_lti_credentials_updated_at();
