locals {
  exports_bucket = "${var.project}-exports-${data.aws_caller_identity.current.account_id}"
  exports_prefix = "exports/"
}

resource "aws_s3_bucket" "exports" {
  bucket = local.exports_bucket
}

resource "aws_s3_bucket_public_access_block" "exports" {
  bucket                  = aws_s3_bucket.exports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "exports_tls_only" {
  statement {
    sid       = "DenyNonTlsTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.exports.arn, "${aws_s3_bucket.exports.arn}/*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "exports" {
  bucket = aws_s3_bucket.exports.id
  policy = data.aws_iam_policy_document.exports_tls_only.json
}

resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "delete-exports-after-a-week"
    status = "Enabled"

    filter {
      prefix = local.exports_prefix
    }

    expiration {
      days = var.export_file_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

data "aws_iam_policy_document" "jobs_write_exports" {
  statement {
    sid       = "WriteTheExportFiles"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.exports.arn}/${local.exports_prefix}*"]
  }
}

resource "aws_iam_role_policy" "jobs_write_exports" {
  name   = "${var.project}-jobs-write-exports"
  role   = aws_iam_role.jobs.id
  policy = data.aws_iam_policy_document.jobs_write_exports.json
}

data "aws_iam_policy_document" "app_exports" {
  statement {
    sid       = "SignDownloadLinksOfTheExportFiles"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.exports.arn}/${local.exports_prefix}*"]
  }

  statement {
    sid       = "HandExportsToTheJobsFunction"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.jobs.arn]
  }
}

resource "aws_iam_role_policy" "app_exports" {
  name   = "${var.project}-lambda-exports"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_exports.json
}

resource "aws_ssm_parameter" "export_bucket" {
  for_each    = toset(["app", "jobs"])
  name        = "/${var.project}/${each.key}/EXPORT_BUCKET"
  type        = "String"
  value       = aws_s3_bucket.exports.bucket
  description = "The private bucket the project exports are written to; files expire after a week."
}

resource "aws_ssm_parameter" "jobs_function_name" {
  name        = "/${var.project}/app/JOBS_FUNCTION_NAME"
  type        = "String"
  value       = aws_lambda_function.jobs.function_name
  description = "The function the HTTP function hands each export to, without waiting."
}
