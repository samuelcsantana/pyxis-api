CREATE TABLE "account_usage_months" (
	"account_id" uuid NOT NULL,
	"month" char(7) NOT NULL,
	"events" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_usage_months_pkey" PRIMARY KEY("account_id","month")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ingestion_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_usage_months" ADD CONSTRAINT "account_usage_months_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;