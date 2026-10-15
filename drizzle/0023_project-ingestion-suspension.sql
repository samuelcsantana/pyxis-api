ALTER TABLE "projects" ADD COLUMN "ingestion_suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ingestion_suspension_reason" varchar(500);