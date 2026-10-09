CREATE TABLE "digest_deliveries" (
	"project_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "digest_deliveries_pkey" PRIMARY KEY("project_id","admin_user_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;