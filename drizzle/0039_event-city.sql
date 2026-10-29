ALTER TABLE "events" ADD COLUMN "city" varchar(100);--> statement-breakpoint
CREATE INDEX "events_project_city_idx" ON "events" USING btree ("project_id") WHERE "events"."city" is not null;