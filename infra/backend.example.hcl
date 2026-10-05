bucket       = "pyxis-api-tfstate-<account-id>"
key          = "pyxis-api/terraform.tfstate"
region       = "sa-east-1"
encrypt      = true
use_lockfile = true

assume_role = {
  role_arn     = "arn:aws:iam::<account-id>:role/pyxis-api-terraform"
  session_name = "terraform-backend"
}
