ALTER TABLE "accounts" ADD COLUMN "deletion_held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deletion_hold_reason" varchar(500);