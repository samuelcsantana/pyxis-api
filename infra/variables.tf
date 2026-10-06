variable "project" {
  description = "Prefix of every resource. The provisioning role's policy is scoped to it, so another name here is refused instead of creating differently named resources."
  type        = string
  default     = "pyxis-api"
}

variable "aws_region" {
  description = "Where the functions run: sa-east-1, next to the Neon database in São Paulo."
  type        = string
  default     = "sa-east-1"
}

variable "provisioning_role_arn" {
  description = "Role Terraform assumes and that holds the permissions. Kept out of the repository: set it in terraform.tfvars (see terraform.tfvars.example)."
  type        = string
}

variable "api_domain" {
  description = "The API's own domain. A Lambda Function URL cannot carry a custom domain, which is why CloudFront sits in front of it."
  type        = string
  default     = "api.pyxis.samuelsantana.dev"
}

variable "api_domain_enabled" {
  description = "Serve api_domain from the distribution with the ACM certificate. Turn it on only after the certificate's validation CNAME exists in DNS; until then the distribution answers on its cloudfront.net name."
  type        = bool
  default     = false
}

variable "image_tag" {
  description = "Tag the functions point at when Terraform creates them. The deploy script moves the image afterwards, and Terraform ignores image changes from then on."
  type        = string
}

variable "image_retention_count" {
  description = "Tagged images ECR keeps as rollback targets. Lambda pins a digest, so expiring an old tag never breaks a running function."
  type        = number
  default     = 5
}

variable "log_retention_days" {
  description = "How long CloudWatch keeps the functions' logs; Lambda's default is forever."
  type        = number
  default     = 14
}

variable "http_reserved_concurrency" {
  description = "Most execution environments the HTTP function may run at once. The rate limits live in each environment's memory, so this also bounds their global worst case (limit times this number)."
  type        = number
  default     = 10
}

variable "dashboard_origin" {
  description = "Origin of the dashboard: scheme and host, no path. The API refuses to start in production without it."
  type        = string
  default     = "https://pyxis.samuelsantana.dev"
}

variable "session_cookie_domain" {
  description = "Domain the session cookie is scoped to. The API on a subdomain of it may set it, and the dashboard's server receives it."
  type        = string
  default     = "pyxis.samuelsantana.dev"
}

variable "mail_from" {
  description = "From header of the sign-in code emails."
  type        = string
  default     = "Pyxis <noreply@samuelsantana.dev>"
}
