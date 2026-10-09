resource "aws_scheduler_schedule" "retention" {
  name                         = "${var.project}-retention"
  description                  = "Runs the daily retention job: events older than 13 months, expired sessions and sign-in codes."
  schedule_expression          = "cron(0 6 * * ? *)"
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.jobs.arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}

resource "aws_scheduler_schedule" "weekly_digest" {
  name                         = "${var.project}-weekly-digest"
  description                  = "Mondays 08:00 in Brasilia: e-mails each admin the week that closed on Sunday in their project's time zone."
  schedule_expression          = "cron(0 11 ? * MON *)"
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.jobs.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ job = "weekly-digest" })

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}
