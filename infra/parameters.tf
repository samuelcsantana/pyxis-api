locals {
  app_secrets = ["DATABASE_URL", "EDGE_SHARED_SECRET"]
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
