CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'admin' NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"email_verified" timestamp with time zone,
	"stripe_customer_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "lti_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consumer_key" text NOT NULL,
	"consumer_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lti_credentials_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "lti_credentials_consumer_key_unique" UNIQUE("consumer_key")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_type" varchar(20) NOT NULL,
	"service_name" varchar(100),
	"service_category" varchar(50),
	"credits_used" integer NOT NULL,
	"credits_before" integer NOT NULL,
	"credits_after" integer NOT NULL,
	"actual_price" numeric(10, 4),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_credits" integer DEFAULT 0 NOT NULL,
	"total_credits_earned" integer DEFAULT 0 NOT NULL,
	"total_credits_used" integer DEFAULT 0 NOT NULL,
	"last_reset_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "game_attempt_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"user_id" uuid,
	"level_index" integer,
	"event_type" text NOT NULL,
	"event_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_attempt_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"level_index" integer NOT NULL,
	"level_name" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"max_points" integer DEFAULT 0 NOT NULL,
	"accuracy_percent" integer DEFAULT 0 NOT NULL,
	"best_time_ms" integer,
	"raw_best_time" text,
	"difficulty" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_attempt_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text,
	"contribution_score" integer DEFAULT 0 NOT NULL,
	"paste_count" integer DEFAULT 0 NOT NULL,
	"large_paste_count" integer DEFAULT 0 NOT NULL,
	"focus_loss_count" integer DEFAULT 0 NOT NULL,
	"active_edit_ms" integer DEFAULT 0 NOT NULL,
	"edit_count" integer DEFAULT 0 NOT NULL,
	"reset_level_count" integer DEFAULT 0 NOT NULL,
	"reset_game_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"instance_id" uuid,
	"user_id" uuid,
	"group_id" uuid,
	"scope" text NOT NULL,
	"player_display_name" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"final_points" integer DEFAULT 0 NOT NULL,
	"max_points" integer DEFAULT 0 NOT NULL,
	"accuracy_percent" integer DEFAULT 0 NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"is_finished" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"user_id" text,
	"group_id" uuid,
	"progress_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"identifier" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_levels" (
	"map_name" text NOT NULL,
	"level_identifier" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_levels_map_name_level_identifier_pk" PRIMARY KEY("map_name","level_identifier")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"name" text PRIMARY KEY NOT NULL,
	"random" integer DEFAULT 0 NOT NULL,
	"can_use_ai" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_collaborators" (
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_collaborators_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"map_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"progress_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"thumbnail_url" text,
	"hide_sidebar" boolean DEFAULT false NOT NULL,
	"access_window_enabled" boolean DEFAULT false NOT NULL,
	"access_starts_at" timestamp with time zone,
	"access_ends_at" timestamp with time zone,
	"access_key_required" boolean DEFAULT false NOT NULL,
	"access_key" text,
	"collaboration_mode" text DEFAULT 'individual' NOT NULL,
	"allow_duplicate_users" boolean DEFAULT true NOT NULL,
	"drawboard_capture_mode" text DEFAULT 'browser' NOT NULL,
	"manual_drawboard_capture" boolean DEFAULT false NOT NULL,
	"remote_sync_debounce_ms" integer DEFAULT 500 NOT NULL,
	"drawboard_reload_debounce_ms" integer DEFAULT 48 NOT NULL,
	"group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_changes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"document_id" varchar(36),
	"session_id" varchar(36),
	"user_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"operation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"document_id" varchar(36),
	"user_id" uuid NOT NULL,
	"user_name" varchar(255),
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cursor_position" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_shares" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"document_id" varchar(36),
	"owner_user_id" uuid NOT NULL,
	"shared_user_id" uuid,
	"permission" varchar(10) DEFAULT 'viewer' NOT NULL,
	"allow_guest_access" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"title" varchar(500) NOT NULL,
	"content" text,
	"content_html" text,
	"content_json" text,
	"has_been_entered" boolean DEFAULT false NOT NULL,
	"is_temporary" boolean DEFAULT false NOT NULL,
	"anonymous_session_id" varchar(255),
	"claimed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"document_id" varchar(36),
	"file_type" varchar(20) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"file_path" text,
	"drive_file_id" varchar(100),
	"sections" text[],
	"highlight_color" varchar(7),
	"web_view_link" text,
	"web_content_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"join_key" text NOT NULL,
	"lti_context_id" text,
	"lti_context_title" text,
	"resource_link_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_lti_context_id_unique" UNIQUE("lti_context_id"),
	CONSTRAINT "groups_join_key_unique" UNIQUE("join_key")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"name" varchar(500) NOT NULL,
	"provider_slug" varchar(255),
	"description" text,
	"context_length" integer,
	"modalities" text[] NOT NULL,
	"prompt_price" numeric(12, 8),
	"completion_price" numeric(12, 8),
	"image_price" numeric(10, 4),
	"request_price" numeric(10, 4),
	"supports_tool_use" boolean DEFAULT false NOT NULL,
	"supports_prompt_caching" boolean DEFAULT false NOT NULL,
	"supports_response_schema" boolean DEFAULT false NOT NULL,
	"architecture" jsonb,
	"top_provider" jsonb,
	"per_request_limits" jsonb,
	"api_provider" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"privacy_policy_url" text,
	"terms_of_service_url" text,
	"status_page_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "model_usage_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"usage_type" varchar(50) NOT NULL,
	"tokens_used" integer,
	"images_generated" integer,
	"actual_cost" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_default_models" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"text_model" varchar(255),
	"image_model" varchar(255),
	"image_ocr_model" varchar(255),
	"pdf_ocr_model" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_idempotency" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"status" varchar(15) NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_idempotency_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lti_credentials" ADD CONSTRAINT "lti_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempt_events" ADD CONSTRAINT "game_attempt_events_attempt_id_game_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."game_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempt_levels" ADD CONSTRAINT "game_attempt_levels_attempt_id_game_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."game_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempt_participants" ADD CONSTRAINT "game_attempt_participants_attempt_id_game_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."game_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_game_id_projects_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_instance_id_game_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."game_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_instances" ADD CONSTRAINT "game_instances_game_id_projects_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_levels" ADD CONSTRAINT "map_levels_map_name_maps_name_fk" FOREIGN KEY ("map_name") REFERENCES "public"."maps"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_levels" ADD CONSTRAINT "map_levels_level_identifier_levels_identifier_fk" FOREIGN KEY ("level_identifier") REFERENCES "public"."levels"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_map_name_maps_name_fk" FOREIGN KEY ("map_name") REFERENCES "public"."maps"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_changes" ADD CONSTRAINT "document_changes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_changes" ADD CONSTRAINT "document_changes_session_id_document_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."document_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_changes" ADD CONSTRAINT "document_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sessions" ADD CONSTRAINT "document_sessions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sessions" ADD CONSTRAINT "document_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_shared_user_id_users_id_fk" FOREIGN KEY ("shared_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_slug_ai_providers_slug_fk" FOREIGN KEY ("provider_slug") REFERENCES "public"."ai_providers"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage_analytics" ADD CONSTRAINT "model_usage_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_default_models" ADD CONSTRAINT "user_default_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_roles_user_id" ON "admin_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_admin_roles_active" ON "admin_roles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_admin_roles_role" ON "admin_roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_stripe_customer_id" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_users_created_at" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_lti_credentials_consumer_key" ON "lti_credentials" USING btree ("consumer_key");--> statement-breakpoint
CREATE INDEX "idx_lti_credentials_user_id" ON "lti_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_user_id" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_created_at" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_service_name" ON "credit_transactions" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_service_category" ON "credit_transactions" USING btree ("service_category");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_actual_price" ON "credit_transactions" USING btree ("actual_price");--> statement-breakpoint
CREATE INDEX "idx_user_credits_user_id" ON "user_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_events_attempt_id" ON "game_attempt_events" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_events_user_id" ON "game_attempt_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_events_level_index" ON "game_attempt_events" USING btree ("level_index");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_levels_attempt_id" ON "game_attempt_levels" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_levels_level_index" ON "game_attempt_levels" USING btree ("level_index");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_participants_attempt_id" ON "game_attempt_participants" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempt_participants_user_id" ON "game_attempt_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_game_id" ON "game_attempts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_finished_at" ON "game_attempts" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_game_score_time" ON "game_attempts" USING btree ("game_id","final_points","duration_ms");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_user_id" ON "game_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_group_id" ON "game_attempts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_game_attempts_instance_id" ON "game_attempts" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_game_instances_game_id" ON "game_instances" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_instances_group_id" ON "game_instances" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_game_instances_user_id" ON "game_instances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_instances_scope" ON "game_instances" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_game_instances_updated_at" ON "game_instances" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_levels_name" ON "levels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_map_levels_map_name" ON "map_levels" USING btree ("map_name");--> statement-breakpoint
CREATE INDEX "idx_map_levels_level_identifier" ON "map_levels" USING btree ("level_identifier");--> statement-breakpoint
CREATE INDEX "idx_project_collaborators_project_id" ON "project_collaborators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_collaborators_user_id" ON "project_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_map_name" ON "projects" USING btree ("map_name");--> statement-breakpoint
CREATE INDEX "idx_projects_user_map" ON "projects" USING btree ("user_id","map_name");--> statement-breakpoint
CREATE INDEX "idx_projects_updated_at" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_projects_is_public" ON "projects" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_projects_share_token" ON "projects" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_projects_access_window_enabled" ON "projects" USING btree ("access_window_enabled");--> statement-breakpoint
CREATE INDEX "idx_projects_group_id" ON "projects" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_key" ON "user_sessions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_document_changes_document_id" ON "document_changes" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_changes_version" ON "document_changes" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "idx_document_sessions_document_id" ON "document_sessions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_sessions_last_active" ON "document_sessions" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "idx_document_shares_document_id" ON "document_shares" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_shares_shared_user_id" ON "document_shares" USING btree ("shared_user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_user_id" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_updated_at" ON "documents" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_documents_temporary_expires" ON "documents" USING btree ("is_temporary","expires_at");--> statement-breakpoint
CREATE INDEX "idx_documents_anonymous_session" ON "documents" USING btree ("anonymous_session_id");--> statement-breakpoint
CREATE INDEX "idx_source_files_document_id" ON "source_files" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_group_id" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_user_id" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_groups_lti_context_id" ON "groups" USING btree ("lti_context_id");--> statement-breakpoint
CREATE INDEX "idx_groups_created_by" ON "groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_ai_models_model_id" ON "ai_models" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "idx_ai_models_provider_slug" ON "ai_models" USING btree ("provider_slug");--> statement-breakpoint
CREATE INDEX "idx_ai_models_active" ON "ai_models" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ai_models_prompt_price" ON "ai_models" USING btree ("prompt_price");--> statement-breakpoint
CREATE INDEX "idx_ai_models_image_price" ON "ai_models" USING btree ("image_price");--> statement-breakpoint
CREATE INDEX "idx_ai_providers_slug" ON "ai_providers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_ai_providers_active" ON "ai_providers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_model_usage_user_id" ON "model_usage_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_model_usage_model_id" ON "model_usage_analytics" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "idx_model_usage_created_at" ON "model_usage_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_model_usage_type" ON "model_usage_analytics" USING btree ("usage_type");--> statement-breakpoint
CREATE INDEX "idx_user_default_models_user_id" ON "user_default_models" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_idempotency_status" ON "webhook_idempotency" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_idempotency_event_id" ON "webhook_idempotency" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_idempotency_created_at" ON "webhook_idempotency" USING btree ("created_at");