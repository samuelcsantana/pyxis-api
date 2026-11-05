CREATE TABLE "project_slack_webhooks" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"sealed_url" text NOT NULL,
	"hint" varchar(4) NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	"broken_at" timestamp with time zone,
	"broken_reason" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "slack_alert_deliveries" (
	"project_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"day" date NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "slack_alert_deliveries_pkey" PRIMARY KEY("project_id","kind","day"),
	CONSTRAINT "slack_alert_deliveries_kind_check" CHECK ("slack_alert_deliveries"."kind" in ('no_events', 'failed_writes', 'conversion_drop'))
);
--> statement-breakpoint
ALTER TABLE "project_slack_webhooks" ADD CONSTRAINT "project_slack_webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_alert_deliveries" ADD CONSTRAINT "slack_alert_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;