resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_log_metric_filter" "database_size_ratio" {
  name           = "${var.project}-database-size-ratio"
  log_group_name = aws_cloudwatch_log_group.function["${var.project}-jobs"].name
  pattern        = "{ $.message.message = \"database.size\" }"

  metric_transformation {
    name      = "DatabaseSizeRatio"
    namespace = var.metrics_namespace
    value     = "$.message.ratio"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_size" {
  alarm_name          = "${var.project}-database-size"
  alarm_description   = "The Pyxis database uses ${var.database_size_alarm_ratio * 100}% or more of the free Neon branch limit."
  namespace           = var.metrics_namespace
  metric_name         = "DatabaseSizeRatio"
  statistic           = "Maximum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = var.database_size_alarm_ratio
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "rejected_sign_in_codes" {
  name           = "${var.project}-rejected-sign-in-codes"
  log_group_name = aws_cloudwatch_log_group.function[var.project].name
  pattern        = "{ $.message.message = \"auth.invalid_code_attempt\" }"

  metric_transformation {
    name          = "RejectedSignInCodes"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "rejected_sign_in_codes" {
  alarm_name          = "${var.project}-rejected-sign-in-codes"
  alarm_description   = "${var.rejected_sign_in_codes_alarm_threshold} or more dashboard sign-in codes were rejected within 15 minutes: someone may be guessing codes."
  namespace           = var.metrics_namespace
  metric_name         = "RejectedSignInCodes"
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = var.rejected_sign_in_codes_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "refused_sign_in_code_requests" {
  name           = "${var.project}-refused-sign-in-code-requests"
  log_group_name = aws_cloudwatch_log_group.function[var.project].name
  pattern        = "{ $.message.message = \"auth.code_rate_limited\" }"

  metric_transformation {
    name          = "RefusedSignInCodeRequests"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "refused_sign_in_code_requests" {
  alarm_name          = "${var.project}-refused-sign-in-code-requests"
  alarm_description   = "${var.refused_sign_in_code_requests_alarm_threshold} or more sign-in code requests were refused within an hour because an admin's email had already received its five codes: someone may be flooding an admin's inbox."
  namespace           = var.metrics_namespace
  metric_name         = "RefusedSignInCodeRequests"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.refused_sign_in_code_requests_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "unhandled_errors" {
  name           = "${var.project}-unhandled-errors"
  log_group_name = aws_cloudwatch_log_group.function[var.project].name
  pattern        = "{ $.message.message = \"http.unhandled_error\" }"

  metric_transformation {
    name          = "UnhandledErrors"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "unhandled_errors" {
  alarm_name          = "${var.project}-unhandled-errors"
  alarm_description   = "${var.unhandled_errors_alarm_threshold} or more requests ended in an unexpected error (500) within five minutes: the API or its database may be failing."
  namespace           = var.metrics_namespace
  metric_name         = "UnhandledErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.unhandled_errors_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "function_errors" {
  alarm_name          = "${var.project}-function-errors"
  alarm_description   = "${var.function_errors_alarm_threshold} or more invocations of the HTTP function failed or timed out within five minutes: requests are not reaching the application."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.function_errors_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "jobs_function_errors" {
  alarm_name          = "${var.project}-jobs-function-errors"
  alarm_description   = "${var.jobs_function_errors_alarm_threshold} or more invocations of the jobs function failed or timed out within five minutes: a step of the daily jobs threw (retention, the cities a project turned off included, account usage, account deletions, stalled exports, notices), or the weekly digest or an export failed. The rest of that run did not happen and nothing retries it before the next schedule; read the log lines of the run, fix the cause and run the jobs again (docs/RUNBOOK.md, The daily jobs)."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.jobs.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.jobs_function_errors_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "daily_jobs_completed" {
  name           = "${var.project}-daily-jobs-completed"
  log_group_name = aws_cloudwatch_log_group.function["${var.project}-jobs"].name
  pattern        = "{ $.message.message = \"jobs.daily_done\" }"

  metric_transformation {
    name          = "DailyJobsCompleted"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "daily_jobs_missed" {
  alarm_name          = "${var.project}-daily-jobs-missed"
  alarm_description   = "No daily run of the jobs function finished within ${var.daily_jobs_missed_after_hours} hours (no jobs.daily_done line): the 06:00 UTC schedule did not run, the run failed before its end, or it has been waiting for the function too long. Retention, the erase of the cities a project turned off (promised within 48 hours), the account lifecycle and the notices did not run; find the cause in the jobs function's logs and run the daily jobs by hand (docs/RUNBOOK.md, The daily jobs)."
  namespace           = var.metrics_namespace
  metric_name         = "DailyJobsCompleted"
  statistic           = "Sum"
  period              = var.daily_jobs_missed_after_hours * 3600
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "daily_job_step_failures" {
  name           = "${var.project}-daily-job-step-failures"
  log_group_name = aws_cloudwatch_log_group.function["${var.project}-jobs"].name
  pattern        = "{ $.message.message = \"retention.step_failed\" || $.message.message = \"jobs.project_icons_failed\" || $.message.message = \"jobs.demo_traffic_failed\" || $.message.message = \"accounts.reconcile_failed\" || $.message.message = \"account_usage.notice_failed\" || $.message.message = \"exports.failed\" }"

  metric_transformation {
    name          = "DailyJobStepFailures"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "daily_job_step_failures" {
  alarm_name          = "${var.project}-daily-job-step-failures"
  alarm_description   = "${var.daily_job_step_failures_alarm_threshold} or more steps of the jobs function failed within an hour: retention.step_failed (its step field names it; cities means the erase promised within 48 hours did not happen), jobs.project_icons_failed, jobs.demo_traffic_failed, accounts.reconcile_failed (Stripe unreadable for an account), account_usage.notice_failed (an owner not told of the monthly limit) or exports.failed. Most are swallowed, so the run goes on and no other alarm fires; read the line in the jobs function's logs."
  namespace           = var.metrics_namespace
  metric_name         = "DailyJobStepFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.daily_job_step_failures_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "function_throttles" {
  alarm_name          = "${var.project}-function-throttles"
  alarm_description   = "${var.function_throttles_alarm_threshold} or more requests were refused within five minutes because every execution environment of the HTTP function was busy: raise http_reserved_concurrency or look for abuse."
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.function_throttles_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "repeated_trials" {
  name           = "${var.project}-repeated-trials"
  log_group_name = aws_cloudwatch_log_group.function[var.project].name
  pattern        = "{ $.message.message = \"billing.repeated_trial\" }"

  metric_transformation {
    name          = "RepeatedTrials"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "repeated_trials" {
  alarm_name          = "${var.project}-repeated-trials"
  alarm_description   = "${var.repeated_trials_alarm_threshold} or more free trials started within an hour with a card that already started a trial in another account: look up the accounts named in the billing.repeated_trial log line and decide by hand."
  namespace           = var.metrics_namespace
  metric_name         = "RepeatedTrials"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.repeated_trials_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

locals {
  account_log_groups = {
    http = aws_cloudwatch_log_group.function[var.project].name
    jobs = aws_cloudwatch_log_group.function["${var.project}-jobs"].name
  }
}

resource "aws_cloudwatch_log_metric_filter" "refund_failures" {
  for_each       = local.account_log_groups
  name           = "${var.project}-refund-failures-${each.key}"
  log_group_name = each.value
  pattern        = "{ $.message.message = \"accounts.refund_failed\" }"

  metric_transformation {
    name          = "RefundFailures"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "refund_failures" {
  alarm_name          = "${var.project}-refund-failures"
  alarm_description   = "${var.refund_failures_alarm_threshold} or more refunds failed within an hour when an account was closed: find the accounts.refund_failed log line and refund by hand in Stripe within two business days."
  namespace           = var.metrics_namespace
  metric_name         = "RefundFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.refund_failures_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "account_notice_failures" {
  for_each       = local.account_log_groups
  name           = "${var.project}-account-notice-failures-${each.key}"
  log_group_name = each.value
  pattern        = "{ $.message.message = \"accounts.notice_failed\" || $.message.message = \"notices.delivery_failed\" }"

  metric_transformation {
    name          = "AccountNoticeFailures"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "account_notice_failures" {
  alarm_name          = "${var.project}-account-notice-failures"
  alarm_description   = "${var.account_notice_failures_alarm_threshold} or more account e-mails (end of access, deletion reminder, deletion) failed within an hour, or notices sent to every owner (notices.delivery_failed): the daily job tries again tomorrow; check the e-mail provider."
  namespace           = var.metrics_namespace
  metric_name         = "AccountNoticeFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.account_notice_failures_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_log_metric_filter" "sign_up_daily_cap" {
  name           = "${var.project}-sign-up-daily-cap"
  log_group_name = aws_cloudwatch_log_group.function[var.project].name
  pattern        = "{ $.message.message = \"auth.sign_up_daily_cap\" }"

  metric_transformation {
    name          = "SignUpDailyCapReached"
    namespace     = var.metrics_namespace
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "sign_up_daily_cap" {
  alarm_name          = "${var.project}-sign-up-daily-cap"
  alarm_description   = "${var.sign_up_daily_cap_alarm_threshold} or more sign-up code requests were refused within an hour because the day's sign-up codes ran out: new owners cannot sign up until the oldest codes leave the 24-hour window. Many codes sent to made-up addresses also raise the SES bounce rate."
  namespace           = var.metrics_namespace
  metric_name         = "SignUpDailyCapReached"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.sign_up_daily_cap_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ses_bounce_rate" {
  count               = local.ses_enabled ? 1 : 0
  alarm_name          = "${var.project}-ses-bounce-rate"
  alarm_description   = "The SES account's bounce rate reached ${var.ses_bounce_rate_alarm_threshold * 100}%. AWS reviews an account from 5% and can pause its sending from 10%, which stops every e-mail, sign-in codes included: look for sign-up codes sent to made-up addresses."
  namespace           = "AWS/SES"
  metric_name         = "Reputation.BounceRate"
  statistic           = "Maximum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.ses_bounce_rate_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ses_complaint_rate" {
  count               = local.ses_enabled ? 1 : 0
  alarm_name          = "${var.project}-ses-complaint-rate"
  alarm_description   = "The SES account's complaint rate reached ${var.ses_complaint_rate_alarm_threshold * 100}%. AWS reviews an account from 0.1% and can pause its sending from 0.5%, which stops every e-mail, sign-in codes included."
  namespace           = "AWS/SES"
  metric_name         = "Reputation.ComplaintRate"
  statistic           = "Maximum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = var.ses_complaint_rate_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
