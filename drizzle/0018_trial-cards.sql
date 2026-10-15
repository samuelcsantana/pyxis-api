CREATE TABLE "trial_cards" (
	"fingerprint" varchar(255) NOT NULL,
	"account_id" uuid NOT NULL,
	"trial_started_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trial_cards_pkey" PRIMARY KEY("fingerprint","account_id")
);
--> statement-breakpoint
CREATE INDEX "trial_cards_trial_started_at_idx" ON "trial_cards" USING btree ("trial_started_at");