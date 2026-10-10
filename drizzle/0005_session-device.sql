ALTER TABLE "admin_sessions" ADD COLUMN "device_type" varchar(16);--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "browser" varchar(32);--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "os" varchar(32);