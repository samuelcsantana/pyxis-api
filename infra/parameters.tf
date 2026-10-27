locals {
  app_secrets = [
    "DATABASE_URL",
    "EDGE_SHARED_SECRET",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]

  free_plan_settings = {
    FREE_ACCOUNTS_MAX = {
      value       = tostring(var.free_accounts_max)
      description = "How many accounts the free plan holds at most; past it, a new owner waits for a place."
    }
    FREE_PLAN_OPEN = {
      value       = tostring(var.free_plan_open)
      description = "Whether new owners start on the free plan and the daily job opens waiting accounts."
    }
  }

  app_settings = {
    API_ORIGIN = {
      value       = var.api_domain_enabled ? "https://${var.api_domain}" : "https://${aws_cloudfront_distribution.api.domain_name}"
      description = "The API's own origin: the OAuth issuer of the Claude connector and the base of its MCP address."
    }
    DASHBOARD_ORIGIN = {
      value       = var.dashboard_origin
      description = "The only origin the dashboard sign-in routes accept and grant CORS to, and the base of the e-mail links and logo."
    }
    MAIL_FROM = {
      value       = var.mail_from
      description = "Sender of the sign-in code emails. Its domain must be verified in Resend or SES."
    }
    MAIL_PROVIDER = {
      value       = var.mail_provider
      description = "Which service sends the sign-in code e-mails: resend or ses."
    }
    PROMOTION_CODES_OPEN = {
      value       = tostring(var.promotion_codes_open)
      description = "Whether Stripe Checkout shows the promotion code field."
    }
    REMOTE_MCP_OPEN = {
      value       = tostring(var.remote_mcp_open)
      description = "Whether applications can connect through OAuth; while false the OAuth addresses answer 404."
    }
    SIGNUP_OPEN = {
      value       = tostring(var.signup_open)
      description = "Whether anyone can create an account and subscribe; also needs TERMS_VERSION."
    }
    TRIAL_OFFERED = {
      value       = tostring(var.trial_offered)
      description = "Whether Checkout offers the 14-day trial to a customer Stripe does not know yet."
    }
  }
}

resource "aws_ssm_parameter" "terms_url" {
  for_each    = var.terms_url == null ? toset([]) : toset(["app", "jobs"])
  name        = "/${var.project}/${each.key}/TERMS_URL"
  type        = "String"
  value       = var.terms_url
  description = "Where the published terms are; sign-up shows it and the welcome e-mail links to it."
}

resource "aws_ssm_parameter" "free_plan_setting" {
  for_each = {
    for pair in setproduct(["app", "jobs"], keys(local.free_plan_settings)) :
    "${pair[0]}/${pair[1]}" => local.free_plan_settings[pair[1]]
  }
  name        = "/${var.project}/${each.key}"
  type        = "String"
  value       = each.value.value
  description = each.value.description
}

resource "aws_ssm_parameter" "free_plan_terms_for_earlier_accounts_from" {
  for_each    = var.free_plan_terms_for_earlier_accounts_from == null ? toset([]) : toset(["app", "jobs"])
  name        = "/${var.project}/${each.key}/FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM"
  type        = "String"
  value       = var.free_plan_terms_for_earlier_accounts_from
  description = "When the terms with the free plan bind earlier accounts; from then a cancelled subscription that fits falls back to free."
}

resource "aws_ssm_parameter" "terms_version" {
  count       = var.terms_version == null ? 0 : 1
  name        = "/${var.project}/app/TERMS_VERSION"
  type        = "String"
  value       = var.terms_version
  description = "The version of the published terms a new owner must accept to sign up."
}

resource "aws_ssm_parameter" "app_secret" {
  for_each    = toset(local.app_secrets)
  name        = "/${var.project}/app/${each.key}"
  type        = "SecureString"
  value       = "placeholder-set-in-the-console"
  description = "Read at cold start by the HTTP function. Terraform owns that it exists, never its value."

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "app_setting" {
  for_each    = local.app_settings
  name        = "/${var.project}/app/${each.key}"
  type        = "String"
  value       = each.value.value
  description = each.value.description
}

resource "aws_ssm_parameter" "client_ip_header" {
  name        = "/${var.project}/app/CLIENT_IP_HEADER"
  type        = "String"
  value       = "cloudfront-viewer-address"
  description = "The header CloudFront overwrites with the viewer's address, used by the per-address rate limit."
}

resource "aws_ssm_parameter" "migration_database_url" {
  name        = "/${var.project}/migrate/MIGRATION_DATABASE_URL"
  type        = "SecureString"
  value       = "placeholder-set-in-the-console"
  description = "The database owner's connection, direct host. Read only by the migration function."

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "app_db_role" {
  name        = "/${var.project}/migrate/APP_DB_ROLE"
  type        = "String"
  value       = "pyxis_app"
  description = "The role the migrations grant row access to; the API connects as it."
}

resource "aws_ssm_parameter" "jobs_database_url" {
  name        = "/${var.project}/jobs/DATABASE_URL"
  type        = "SecureString"
  value       = "placeholder-set-in-the-console"
  description = "The application role's connection for the daily jobs; the same value as /app/DATABASE_URL."

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jobs_resend_api_key" {
  name        = "/${var.project}/jobs/RESEND_API_KEY"
  type        = "SecureString"
  value       = "placeholder-set-in-the-console"
  description = "The Resend key the weekly digest is sent with; the same value as /app/RESEND_API_KEY."

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jobs_stripe_secret_key" {
  name        = "/${var.project}/jobs/STRIPE_SECRET_KEY"
  type        = "SecureString"
  value       = "placeholder-set-in-the-console"
  description = "The Stripe key the daily job reconciles the subscriptions with; the same value as /app/STRIPE_SECRET_KEY."

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jobs_mail_from" {
  name        = "/${var.project}/jobs/MAIL_FROM"
  type        = "String"
  value       = var.mail_from
  description = "Sender of the weekly digest. Its domain must be verified in Resend."
}

resource "aws_ssm_parameter" "jobs_mail_provider" {
  name        = "/${var.project}/jobs/MAIL_PROVIDER"
  type        = "String"
  value       = var.mail_provider
  description = "Which service sends the weekly digest and the account e-mails: resend or ses."
}

resource "aws_ssm_parameter" "jobs_support_email" {
  count       = var.support_email == null ? 0 : 1
  name        = "/${var.project}/jobs/SUPPORT_EMAIL"
  type        = "String"
  value       = var.support_email
  description = "The address the quota notices name and send replies to."
}

resource "aws_ssm_parameter" "jobs_dashboard_origin" {
  name        = "/${var.project}/jobs/DASHBOARD_ORIGIN"
  type        = "String"
  value       = var.dashboard_origin
  description = "The dashboard the weekly digest links to and loads its logo from."
}
