locals {
  ses_enabled          = var.ses_domain != null
  ses_mail_from_domain = local.ses_enabled ? "bounce.${var.ses_domain}" : null
  ses_identity_arn     = local.ses_enabled ? "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_domain}" : null
}

resource "aws_sesv2_email_identity" "mail" {
  count          = local.ses_enabled ? 1 : 0
  email_identity = var.ses_domain
}

resource "aws_sesv2_email_identity_mail_from_attributes" "mail" {
  count                  = local.ses_enabled ? 1 : 0
  email_identity         = aws_sesv2_email_identity.mail[0].email_identity
  mail_from_domain       = local.ses_mail_from_domain
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_sesv2_account_suppression_attributes" "mail" {
  count              = local.ses_enabled ? 1 : 0
  suppressed_reasons = ["BOUNCE", "COMPLAINT"]
}

data "aws_iam_policy_document" "send_mail" {
  count = local.ses_enabled ? 1 : 0

  statement {
    sid       = "SendThroughTheMailIdentity"
    actions   = ["ses:SendEmail"]
    resources = [local.ses_identity_arn]
  }
}

resource "aws_iam_role_policy" "app_send_mail" {
  count  = local.ses_enabled ? 1 : 0
  name   = "${var.project}-lambda-send-mail"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.send_mail[0].json
}

resource "aws_iam_role_policy" "jobs_send_mail" {
  count  = local.ses_enabled ? 1 : 0
  name   = "${var.project}-jobs-send-mail"
  role   = aws_iam_role.jobs.id
  policy = data.aws_iam_policy_document.send_mail[0].json
}
