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
  default     = "api.pyxis-analytics.dev"
}

variable "api_domain_aliases" {
  description = "Earlier domains the API keeps answering on, from the same certificate and distribution, while the sites that send to them move to api_domain."
  type        = list(string)
  default     = ["api.pyxis.samuelsantana.dev"]
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
  default     = "https://app.pyxis-analytics.dev"
}

variable "mail_from" {
  description = "From header of the sign-in code and weekly digest emails; its domain must be verified in Resend."
  type        = string
  default     = "Pyxis <noreply@pyxis-analytics.dev>"
}

variable "alert_email" {
  description = "Address that receives the operational alarms; AWS emails it a link to confirm the subscription."
  type        = string
}

variable "database_size_alarm_ratio" {
  description = "Share of the database size limit at which the size alarm fires."
  type        = number
  default     = 0.7
}

variable "metrics_namespace" {
  description = "CloudWatch namespace of the metrics read from the functions' logs."
  type        = string
  default     = "Pyxis"
}

variable "rejected_sign_in_codes_alarm_threshold" {
  description = "Rejected dashboard sign-in codes within 15 minutes at which the alarm fires. A code allows five guesses, so twenty means at least four codes under attack."
  type        = number
  default     = 20
}

variable "refused_sign_in_code_requests_alarm_threshold" {
  description = "Sign-in code requests refused within an hour, because the email already got its five codes, at which the alarm fires."
  type        = number
  default     = 5
}
