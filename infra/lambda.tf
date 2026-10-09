locals {
  image_uri = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
}

resource "aws_cloudwatch_log_group" "function" {
  for_each          = toset([var.project, "${var.project}-migrate", "${var.project}-jobs"])
  name              = "/aws/lambda/${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "api" {
  function_name                  = var.project
  description                    = "Pyxis API behind CloudFront through its Function URL; configuration from Parameter Store."
  role                           = aws_iam_role.app.arn
  package_type                   = "Image"
  image_uri                      = local.image_uri
  architectures                  = ["x86_64"]
  memory_size                    = 1024
  timeout                        = 30
  reserved_concurrent_executions = var.http_reserved_concurrency

  environment {
    variables = {
      NODE_ENV                = "production"
      CONFIG_PARAMETER_PREFIX = "/${var.project}/app/"
    }
  }

  depends_on = [aws_cloudwatch_log_group.function, aws_iam_role_policy.app]

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "url_public" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "url_invoke" {
  statement_id             = "FunctionURLAllowInvokeAction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "*"
  invoked_via_function_url = true
}

resource "aws_lambda_function_event_invoke_config" "api" {
  function_name          = aws_lambda_function.api.function_name
  maximum_retry_attempts = 0
}

resource "aws_lambda_function" "migrate" {
  function_name = "${var.project}-migrate"
  description   = "Pyxis database migrations, invoked by the deploy script with the owner's connection."
  role          = aws_iam_role.migrate.arn
  package_type  = "Image"
  image_uri     = local.image_uri
  architectures = ["x86_64"]
  memory_size   = 512
  timeout       = 300

  image_config {
    command = ["dist/lambda/migrate-entry.handler"]
  }

  environment {
    variables = {
      NODE_ENV                = "production"
      CONFIG_PARAMETER_PREFIX = "/${var.project}/migrate/"
    }
  }

  depends_on = [aws_cloudwatch_log_group.function, aws_iam_role_policy.migrate]

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "jobs" {
  function_name                  = "${var.project}-jobs"
  description                    = "Pyxis scheduled jobs (daily retention, weekly digest), run by EventBridge Scheduler as the application role."
  role                           = aws_iam_role.jobs.arn
  package_type                   = "Image"
  image_uri                      = local.image_uri
  architectures                  = ["x86_64"]
  memory_size                    = 512
  timeout                        = 900
  reserved_concurrent_executions = 1

  image_config {
    command = ["dist/lambda/jobs-entry.handler"]
  }

  environment {
    variables = {
      NODE_ENV                = "production"
      CONFIG_PARAMETER_PREFIX = "/${var.project}/jobs/"
    }
  }

  depends_on = [aws_cloudwatch_log_group.function, aws_iam_role_policy.jobs]

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function_event_invoke_config" "jobs" {
  function_name          = aws_lambda_function.jobs.function_name
  maximum_retry_attempts = 0
}
