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
  description = "The API's own domain, such as pyxis-api.example.com. A Lambda Function URL cannot carry a custom domain, which is why CloudFront sits in front of it. No default: the certificate is requested for it on the first apply."
  type        = string
}

variable "api_domain_aliases" {
  description = "Earlier domains the API keeps answering on, from the same certificate and distribution, while the sites that send to them move to api_domain."
  type        = list(string)
  default     = []
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
  description = "Origin of the dashboard: scheme and host, no path, such as https://pyxis.example.com. The API refuses to start in production without it."
  type        = string
}

variable "mail_from" {
  description = "From header of the sign-in code and weekly digest emails, such as Pyxis <noreply@example.com>; its domain must be verified in Resend."
  type        = string
}

variable "ses_domain" {
  description = "Domain to send e-mail from through Amazon SES in this region, such as example.com. Leave unset to keep SES off; set mail_provider to ses only once the identity is verified and the account has production access."
  type        = string
  default     = null
}

variable "mail_provider" {
  description = "Which service sends the e-mails: resend (needs the Resend key parameters) or ses (needs ses_domain)."
  type        = string
  default     = "resend"

  validation {
    condition     = contains(["resend", "ses"], var.mail_provider)
    error_message = "mail_provider is resend or ses."
  }
}

variable "support_email" {
  description = "Address every e-mail names in its footer and sends replies to, such as hello@example.com. Leave unset to name none."
  type        = string
  default     = null
}

variable "signup_open" {
  description = "Let anyone create an account and subscribe. Keep false until the terms are published and Stripe is live."
  type        = bool
  default     = false
}

variable "free_plan_open" {
  description = "Let new owners start on the free plan without a card, and let the daily job open waiting accounts. Keep false until terms 1.3 are published."
  type        = bool
  default     = false
}

variable "free_accounts_max" {
  description = "How many accounts the free plan holds at most; past it, a new owner waits for a place."
  type        = number
  default     = 200

  validation {
    condition     = var.free_accounts_max >= 0 && floor(var.free_accounts_max) == var.free_accounts_max
    error_message = "free_accounts_max must be a whole number, zero or more."
  }
}

variable "trial_offered" {
  description = "Offer the 14-day trial in Checkout to a customer Stripe does not know yet. Set false the day terms 1.3 take effect: they have no trial."
  type        = bool
  default     = true
}

variable "free_plan_terms_for_earlier_accounts_from" {
  description = "The instant the terms with the free plan bind the accounts created before them, with its offset, such as 2026-12-20T00:00:00-03:00. Until then a cancelled subscription of such an account ends as the earlier terms say."
  type        = string
  default     = null

  validation {
    condition     = var.free_plan_terms_for_earlier_accounts_from == null || can(regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(Z|[+-]\\d{2}:\\d{2})$", coalesce(var.free_plan_terms_for_earlier_accounts_from, "x")))
    error_message = "free_plan_terms_for_earlier_accounts_from is an instant with its offset, such as 2026-12-20T00:00:00-03:00."
  }
}

variable "promotion_codes_open" {
  description = "Show the promotion code field in Stripe Checkout, for codes made in the Stripe dashboard. Turning it off keeps the discounts already applied."
  type        = bool
  default     = false
}

variable "remote_mcp_open" {
  description = "Let Claude and Claude Code connect through OAuth. Keep false until the terms that describe the connector are published."
  type        = bool
  default     = false
}

variable "terms_version" {
  description = "Version of the published terms a new owner accepts, such as 2026-11-01; the dashboard shows the same version. Sign-up stays closed without it."
  type        = string
  default     = null

  validation {
    condition     = var.terms_version == null || length(coalesce(var.terms_version, "x")) <= 32
    error_message = "terms_version has at most 32 characters."
  }
}

variable "terms_url" {
  description = "Address of the published terms, such as https://example.com/terms. Sign-up stays closed without it."
  type        = string
  default     = null

  validation {
    condition     = var.terms_url == null || startswith(coalesce(var.terms_url, "https://"), "https://")
    error_message = "terms_url is an https address."
  }
}

variable "export_file_days" {
  description = "Days an export file stays in the bucket before the lifecycle rule deletes it; the API offers the download for the same days."
  type        = number
  default     = 7
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

variable "unhandled_errors_alarm_threshold" {
  description = "Requests that end in an unexpected error (500) within five minutes at which the alarm fires."
  type        = number
  default     = 5
}

variable "function_errors_alarm_threshold" {
  description = "Failed or timed-out invocations of the HTTP function within five minutes at which the alarm fires."
  type        = number
  default     = 3
}

variable "function_throttles_alarm_threshold" {
  description = "Throttled requests to the HTTP function within five minutes at which the alarm fires."
  type        = number
  default     = 10
}

variable "repeated_trials_alarm_threshold" {
  description = "Free trials started within an hour with a card that already started a trial in another account, at which the alarm fires."
  type        = number
  default     = 1
}

variable "refund_failures_alarm_threshold" {
  description = "Refunds that failed within an hour when an account was closed, at which the alarm fires."
  type        = number
  default     = 1
}

variable "account_notice_failures_alarm_threshold" {
  description = "Account e-mails that failed within an hour, at which the alarm fires."
  type        = number
  default     = 1
}
