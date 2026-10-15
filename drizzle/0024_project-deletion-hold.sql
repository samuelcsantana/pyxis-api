ALTER TABLE "projects" ADD COLUMN "deletion_held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deletion_hold_reason" varchar(500);