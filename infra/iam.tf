locals {
  parameter_arn_prefix = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project}"
}

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.project}-lambda"
  description        = "Execution role of the ${var.project} HTTP function: logs and its own parameters only."
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "app_logs" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "ReadTheAppParameters"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.parameter_arn_prefix}/app", "${local.parameter_arn_prefix}/app/*"]
  }

  statement {
    sid       = "DecryptThemThroughSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${var.project}-lambda"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_role" "migrate" {
  name               = "${var.project}-migrate"
  description        = "Execution role of the ${var.project} migration function, the only one that reads the database owner's connection."
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "migrate_logs" {
  role       = aws_iam_role.migrate.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "migrate" {
  statement {
    sid       = "ReadTheMigrationParameters"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.parameter_arn_prefix}/migrate", "${local.parameter_arn_prefix}/migrate/*"]
  }

  statement {
    sid       = "DecryptThemThroughSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "migrate" {
  name   = "${var.project}-migrate"
  role   = aws_iam_role.migrate.id
  policy = data.aws_iam_policy_document.migrate.json
}

resource "aws_iam_role" "jobs" {
  name               = "${var.project}-jobs"
  description        = "Execution role of the ${var.project} jobs function: logs and its own parameters only."
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "jobs_logs" {
  role       = aws_iam_role.jobs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "jobs" {
  statement {
    sid       = "ReadTheJobsParameters"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.parameter_arn_prefix}/jobs", "${local.parameter_arn_prefix}/jobs/*"]
  }

  statement {
    sid       = "DecryptThemThroughSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "jobs" {
  name   = "${var.project}-jobs"
  role   = aws_iam_role.jobs.id
  policy = data.aws_iam_policy_document.jobs.json
}

data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.project}-scheduler"
  description        = "Lets EventBridge Scheduler invoke the ${var.project} jobs function."
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    sid       = "InvokeTheJobsFunction"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.jobs.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "${var.project}-scheduler"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}
