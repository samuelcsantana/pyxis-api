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
