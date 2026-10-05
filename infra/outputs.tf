output "provisioning_identity" {
  description = "Who Terraform acts as. Should be the assumed pyxis-api-terraform role; a user or the root here means the assume_role wiring came undone."
  value       = data.aws_caller_identity.current.arn
}

output "ecr_repository_url" {
  description = "Push target for the Dockerfile.lambda image."
  value       = aws_ecr_repository.api.repository_url
}

output "function_url" {
  description = "The HTTP function's own URL. Public by necessity; without CloudFront's secret header it answers 403."
  value       = aws_lambda_function_url.api.function_url
}

output "cloudfront_domain" {
  description = "Where the API answers before the DNS record exists, and what the API domain's CNAME points at."
  value       = aws_cloudfront_distribution.api.domain_name
}

output "cloudfront_distribution_id" {
  description = "For the console step that writes the origin's secret header."
  value       = aws_cloudfront_distribution.api.id
}

output "certificate_validation_record" {
  description = "The CNAME to add in DNS. Until it resolves the certificate stays PENDING_VALIDATION and api_domain_enabled must stay off."
  value = {
    for option in aws_acm_certificate.api.domain_validation_options :
    option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}
