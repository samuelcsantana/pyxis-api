CREATE TABLE "reviewer_codes" (
	"admin_user_id" uuid PRIMARY KEY NOT NULL,
	"code_hash" char(64) NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviewer_codes" ADD CONSTRAINT "reviewer_codes_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;