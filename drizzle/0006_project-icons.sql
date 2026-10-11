CREATE TABLE "project_icons" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"content_type" varchar(32) NOT NULL,
	"bytes" "bytea" NOT NULL,
	"version" varchar(16) NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_icons" ADD CONSTRAINT "project_icons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;