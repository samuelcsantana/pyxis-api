data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${var.project}-all-viewer-except-host"
  comment = "Every viewer and CloudFront header except Host, so the API sees CloudFront-Viewer-Address."

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

locals {
  mcp_path_pattern        = "/mcp"
  connector_path_patterns = [local.mcp_path_pattern, "/oauth/*", "/.well-known/oauth-*"]
  not_found_body          = jsonencode({ status_code = 404, error = "not_found", message = "Nothing lives at this address." })
}

resource "aws_cloudfront_function" "connector_host" {
  name    = "${var.project}-connector-host"
  runtime = "cloudfront-js-2.0"
  comment = "404 on the connector paths for any host but api_domain: OAuth names one resource."
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var host = request.headers.host ? request.headers.host.value.toLowerCase() : "";
      if (host === ${jsonencode(lower(var.api_domain))}) {
        return request;
      }
      return {
        statusCode: 404,
        statusDescription: "Not Found",
        headers: { "content-type": { value: "application/json" } },
        body: { encoding: "text", data: ${jsonencode(local.not_found_body)} }
      };
    }
  EOT
}

resource "aws_cloudfront_response_headers_policy" "mcp_challenge" {
  name    = "${var.project}-mcp-challenge"
  comment = "WWW-Authenticate on /mcp: Lambda function URLs rename the challenge the API sends."

  custom_headers_config {
    items {
      header   = "WWW-Authenticate"
      value    = "Bearer resource_metadata=\"https://${var.api_domain}/.well-known/oauth-protected-resource/mcp\", scope=\"read\""
      override = false
    }
  }
}

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.project}: CloudFront in front of the HTTP function's URL"
  aliases         = var.api_domain_enabled ? concat([var.api_domain], var.api_domain_aliases) : []
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

  dynamic "ordered_cache_behavior" {
    for_each = local.connector_path_patterns
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = "lambda-function-url"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
      origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
      response_headers_policy_id = (
        ordered_cache_behavior.value == local.mcp_path_pattern
        ? aws_cloudfront_response_headers_policy.mcp_challenge.id
        : null
      )

      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.connector_host.arn
      }
    }
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
