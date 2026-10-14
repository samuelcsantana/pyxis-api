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
