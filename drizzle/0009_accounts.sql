CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_admin_id" uuid NOT NULL,
	"status" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_status_check" CHECK ("accounts"."status" in ('incomplete', 'trialing', 'active', 'past_due', 'ending', 'ended', 'comped'))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_admin_id_admin_users_id_fk" FOREIGN KEY ("owner_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_owner_admin_id_idx" ON "accounts" USING btree ("owner_admin_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_account_id_idx" ON "projects" USING btree ("account_id");