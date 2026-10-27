ALTER TABLE "accounts" ADD COLUMN "back_to_free_notice_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "free_plan_fit_due_at" timestamp with time zone;