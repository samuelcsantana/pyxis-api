CREATE TABLE "alert_deliveries" (
	"project_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"day" date NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY("project_id","admin_user_id","kind","day"),
	CONSTRAINT "alert_deliveries_kind_check" CHECK ("alert_deliveries"."kind" in ('no_events', 'failed_writes', 'conversion_drop'))
);
--> statement-breakpoint
ALTER TABLE "admin_project_access" ADD COLUMN "no_events_alert" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_project_access" ADD COLUMN "failed_writes_alert" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_project_access" ADD COLUMN "conversion_drop_alert" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;