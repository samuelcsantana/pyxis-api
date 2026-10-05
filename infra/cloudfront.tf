data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${var.project}-all-viewer-except-host"
  comment = "Every viewer and CloudFront header except Host, including CloudFront-Viewer-Address and CloudFront-Viewer-Country, which the managed AllViewer policy does not forward."

  headers_config {
    header_behavior = "allExcept"
    headers {
      items = ["Host"]
    }
  }

  cookies_config {
    cookie_behavior = "all"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.project}: CloudFront in front of the HTTP function's URL"
  aliases         = var.api_domain_enabled ? [var.api_domain] : []
  price_class     = "PriceClass_All"

  origin {
    origin_id   = "lambda-function-url"
    domain_name = replace(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/", "")

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }

    custom_header {
      name  = "x-origin-verify"
      value = "placeholder-cloudfront-origin-secret"
    }
  }

  default_cache_behavior {
    target_origin_id         = "lambda-function-url"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.api_domain_enabled ? null : true
    acm_certificate_arn            = var.api_domain_enabled ? aws_acm_certificate_validation.api[0].certificate_arn : null
    ssl_support_method             = var.api_domain_enabled ? "sni-only" : null
    minimum_protocol_version       = var.api_domain_enabled ? "TLSv1.2_2021" : "TLSv1"
  }

  lifecycle {
    ignore_changes = [origin]
  }
}
