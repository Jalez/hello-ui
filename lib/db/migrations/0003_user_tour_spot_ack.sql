CREATE TABLE IF NOT EXISTS "user_tour_spot_ack" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"spot_key" text NOT NULL,
	"version_seen" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tour_spot_ack_user_id_spot_key_pk" PRIMARY KEY("user_id","spot_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_tour_spot_ack_user_id" ON "user_tour_spot_ack" USING btree ("user_id");
