CREATE TABLE "notice_deliveries" (
	"notice_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notice_deliveries_pkey" PRIMARY KEY("notice_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign" varchar(64) NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notices_campaign_unique" UNIQUE("campaign")
);
--> statement-breakpoint
ALTER TABLE "notice_deliveries" ADD CONSTRAINT "notice_deliveries_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_deliveries" ADD CONSTRAINT "notice_deliveries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;