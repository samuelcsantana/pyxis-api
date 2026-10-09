resource "aws_acm_certificate" "api" {
  provider = aws.us_east_1

  domain_name               = var.api_domain
  subject_alternative_names = var.api_domain_aliases
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "api" {
  count    = var.api_domain_enabled ? 1 : 0
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.api.arn

  timeouts {
    create = "30m"
  }
}
