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
  pattern        = "{ $.message = \"database.size\" }"

  metric_transformation {
    name      = "DatabaseSizeRatio"
    namespace = var.metrics_namespace
    value     = "$.ratio"
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
