locals {
  app_secrets = ["DATABASE_URL", "EDGE_SHARED_SECRET", "RESEND_API_KEY"]

  app_settings = {
    DASHBOARD_ORIGIN = {
      value       = var.dashboard_origin
      description = "The only origin the dashboard sign-in routes accept and grant credentialed CORS to."
    }
    SESSION_COOKIE_DOMAIN = {
      value       = var.session_cookie_domain
      description = "Domain attribute of the session cookie, so the dashboard's own server can read it too."
    }
    MAIL_FROM = {
      value       = var.mail_from
      description = "Sender of the sign-in code emails. Its domain must be verified in Resend."
    }
  }
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
