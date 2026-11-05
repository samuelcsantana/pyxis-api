CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"event_name" varchar(64),
	"path_pattern" varchar(256),
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_check" CHECK (("goals"."kind" = 'event' AND "goals"."event_name" IS NOT NULL AND "goals"."path_pattern" IS NULL)
        OR ("goals"."kind" = 'page' AND "goals"."path_pattern" IS NOT NULL AND "goals"."event_name" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goals_project_position_key" ON "goals" USING btree ("project_id","position");--> statement-breakpoint
INSERT INTO "goals" ("project_id", "name", "kind", "event_name", "position", "created_at")
SELECT "projects"."id", "projects"."conversion_event", 'event', "projects"."conversion_event", 1, now()
FROM "projects"
WHERE "projects"."conversion_event" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "goals" WHERE "goals"."project_id" = "projects"."id");
