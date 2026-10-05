CREATE TABLE "events" (
	"id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"name" varchar(64) NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" varchar(64),
	"path" varchar(256) NOT NULL,
	"referrer_host" varchar(128),
	"utm_source" varchar(64),
	"utm_medium" varchar(64),
	"utm_campaign" varchar(64),
	"from_ad_click" boolean DEFAULT false NOT NULL,
	"device_type" varchar(16) NOT NULL,
	"browser" varchar(32) NOT NULL,
	"os" varchar(32) NOT NULL,
	"country" char(2),
	"channel" varchar(16),
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "events_pkey" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" varchar(8) NOT NULL,
	"public_key" varchar(64),
	"secret_hash" char(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "project_keys_kind_matches_value" CHECK (("project_keys"."kind" = 'public' AND "project_keys"."public_key" IS NOT NULL AND "project_keys"."secret_hash" IS NULL) OR ("project_keys"."kind" = 'secret' AND "project_keys"."secret_hash" IS NOT NULL AND "project_keys"."public_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"conversion_event" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_keys" ADD CONSTRAINT "project_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_project_occurred_at_idx" ON "events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_project_name_occurred_at_idx" ON "events" USING btree ("project_id","name","occurred_at");--> statement-breakpoint
CREATE INDEX "events_project_user_occurred_at_idx" ON "events" USING btree ("project_id","user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_project_session_occurred_at_idx" ON "events" USING btree ("project_id","session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "project_keys_project_id_idx" ON "project_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_keys_public_key_unique" ON "project_keys" USING btree ("public_key") WHERE "project_keys"."kind" = 'public';--> statement-breakpoint
CREATE UNIQUE INDEX "project_keys_secret_hash_unique" ON "project_keys" USING btree ("secret_hash") WHERE "project_keys"."kind" = 'secret';