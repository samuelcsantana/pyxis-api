ALTER TABLE "accounts" ADD COLUMN "free_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "inactivity_notified_at" timestamp with time zone;