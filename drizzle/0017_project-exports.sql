CREATE TABLE "project_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by" uuid,
	"requested_at" timestamp with time zone NOT NULL,
	"status" varchar(16) NOT NULL,
	"finished_at" timestamp with time zone,
	"object_key" varchar(512),
	"event_count" integer,
	CONSTRAINT "project_exports_status_check" CHECK ("project_exports"."status" in ('pending', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "project_exports" ADD CONSTRAINT "project_exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_exports" ADD CONSTRAINT "project_exports_requested_by_admin_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_exports_project_requested_at_idx" ON "project_exports" USING btree ("project_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_exports_one_pending_idx" ON "project_exports" USING btree ("project_id") WHERE "project_exports"."status" = 'pending';