ALTER TABLE "accounts" ADD COLUMN "keys_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ended_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deletion_reminded_at" timestamp with time zone;