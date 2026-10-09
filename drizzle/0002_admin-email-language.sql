ALTER TABLE "admin_users" ADD COLUMN "email_language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "email_language" varchar(8) DEFAULT 'en' NOT NULL;