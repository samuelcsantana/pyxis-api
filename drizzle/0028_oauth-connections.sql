CREATE TABLE "oauth_authorization_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"redirect_uri" varchar(512) NOT NULL,
	"state" varchar(512),
	"code_challenge" char(43) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decision" varchar(16),
	"decided_at" timestamp with time zone,
	"admin_user_id" uuid,
	"code_hash" char(64),
	"code_expires_at" timestamp with time zone,
	"code_used_at" timestamp with time zone,
	"connection_id" uuid,
	CONSTRAINT "oauth_authorization_requests_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "oauth_authorization_requests_decision_check" CHECK ("oauth_authorization_requests"."decision" in ('approved', 'denied'))
);
--> statement-breakpoint
CREATE TABLE "oauth_connection_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"token_hash" char(64) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "oauth_connection_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "oauth_connection_tokens_kind_check" CHECK ("oauth_connection_tokens"."kind" in ('access', 'refresh'))
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "oauth_authorization_requests" ADD CONSTRAINT "oauth_authorization_requests_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_requests" ADD CONSTRAINT "oauth_authorization_requests_connection_id_oauth_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connection_tokens" ADD CONSTRAINT "oauth_connection_tokens_connection_id_oauth_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_connection_tokens_connection_id_idx" ON "oauth_connection_tokens" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "oauth_connections_admin_user_id_idx" ON "oauth_connections" USING btree ("admin_user_id");