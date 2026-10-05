provider "aws" {
  region = var.aws_region

  assume_role {
    role_arn     = var.provisioning_role_arn
    session_name = "terraform"
  }

  default_tags {
    tags = {
      project    = var.project
      managed-by = "terraform"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  assume_role {
    role_arn     = var.provisioning_role_arn
    session_name = "terraform"
  }

  default_tags {
    tags = {
      project    = var.project
      managed-by = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
