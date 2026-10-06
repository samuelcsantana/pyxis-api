# Runbook

How the API is provisioned, deployed, checked and rolled back on AWS. Account ids, the state
bucket, the distribution id and the database endpoints are written as `<placeholders>`: the
filled-in values live with the operator, never in this public repository.

## What runs where

| Piece                                  | Where                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| HTTP function `pyxis-api`              | Lambda in sa-east-1, container image from ECR, behind a public Function URL                                               |
| Migration function `pyxis-api-migrate` | Same image, `dist/lambda/migrate-entry.handler`; invoked by the deploy script                                             |
| CloudFront distribution                | In front of the Function URL; adds the `x-origin-verify` secret header; serves `api.pyxis.samuelsantana.dev`              |
| Configuration                          | Parameter Store under `/pyxis-api/app/` (HTTP) and `/pyxis-api/migrate/` (migrations)                                     |
| Database                               | Neon, São Paulo; the HTTP function connects as `pyxis_app` through the pooler, migrations as the owner on the direct host |

| Jobs function `pyxis-api-jobs` | Same image, `dist/lambda/jobs-entry.handler`; run daily at 06:00 UTC by the EventBridge schedule `pyxis-api-retention`, as the application role; reads `/pyxis-api/jobs/` |

The daily job deletes events older than 13 months (per project, 10,000 rows at a time), then
expired or revoked dashboard sessions and expired sign-in codes. A failed step does not skip the
others, but fails the run, and the scheduler retries it twice within the hour.

## First-time setup

1. **Provisioning identity.** A role `pyxis-api-terraform` holding the permissions, scoped to the
   `pyxis-api` prefix, and a user `pyxis-api-deployer` that may only assume it, used through the AWS
   profile `pyxis-api`. Create the access key in the console and store it with
   `aws configure --profile pyxis-api`; never paste it anywhere else.
2. **State bucket** `pyxis-api-tfstate-<account-id>` in sa-east-1, versioned, encrypted, public
   access blocked, created outside Terraform.
3. **Local Terraform files**, both ignored by git:

   ```bash
   cp infra/backend.example.hcl infra/backend.hcl          # fill in <account-id>
   cp infra/terraform.tfvars.example infra/terraform.tfvars
   ```

4. **First image.** The functions need an image to point at:

   ```bash
   aws ecr create-repository --repository-name pyxis-api --region sa-east-1 --profile pyxis-api
   scripts/deploy-lambda.sh --image-only     # prints the tag; put it in terraform.tfvars
   ```

   Then let Terraform own the repository: `terraform import aws_ecr_repository.api pyxis-api`.

5. **Apply:**

   ```bash
   cd infra
   terraform init -backend-config=backend.hcl
   terraform plan -out plan.tfplan && terraform apply plan.tfplan
   ```

6. **Parameter values**, in the Parameter Store console (Terraform created placeholders and never
   reads the values back): `/pyxis-api/app/DATABASE_URL` (pooler host, `pyxis_app`,
   `sslmode=verify-full`), `/pyxis-api/app/EDGE_SHARED_SECRET` (a long random value),
   `/pyxis-api/app/RESEND_API_KEY` (a Resend key allowed to send only),
   `/pyxis-api/jobs/DATABASE_URL` (the same value as `/pyxis-api/app/DATABASE_URL`),
   `/pyxis-api/migrate/MIGRATION_DATABASE_URL` (direct host, owner, `sslmode=verify-full`).
   `DASHBOARD_ORIGIN`, `SESSION_COOKIE_DOMAIN` and `MAIL_FROM` are plain parameters Terraform sets
   from its variables; the domain of `MAIL_FROM` must be verified in Resend before the first
   sign-in.
7. **Edge secret in CloudFront.** In the distribution's origin, set the `x-origin-verify` custom
   header to the same value as `EDGE_SHARED_SECRET`. Terraform ignores the origin from then on.
   Until both hold the same value, every request through CloudFront answers 403 by design.
8. **Migrate and deploy:** `scripts/deploy-lambda.sh`.
9. **Domain.** Add the certificate's validation CNAME (`terraform output
certificate_validation_record`) and keep a CAA record allowing `amazon.com` on the apex if it
   has CAA records. Once the certificate is issued, set `api_domain_enabled = true`, apply, and
   add a CNAME from `api.pyxis.samuelsantana.dev` to `terraform output cloudfront_domain`.

## Deploy

```bash
scripts/deploy-lambda.sh
```

From a clean working tree on a commit already in `origin/main`. It builds and pushes the image,
runs the migrations, updates the HTTP function only if they succeed, and checks `/health`.
Merging a pull request never deploys.

## Checks after a deploy

```bash
curl -s https://api.pyxis.samuelsantana.dev/health                       # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' "$(terraform -chdir=infra output -raw function_url)health"   # 403
aws logs tail /aws/lambda/pyxis-api --since 15m --profile pyxis-api | grep -E 'client_ip.sources|database.role_ok'
```

`client_ip.sources` must show `"cloudfrontViewerAddress":true` and `"resolvedFrom":"header"`;
`database.role_ok` confirms the function connects as the least-privilege role. A batch sent from
an allowed origin must store a row whose `country` is filled, which proves
`CloudFront-Viewer-Country` arrives.

## The daily jobs

Run them once by hand, for example after the first deploy:

```bash
aws lambda invoke --function-name pyxis-api-jobs --region sa-east-1 --profile pyxis-api \
  --cli-read-timeout 910 jobs.json && cat jobs.json   # {"ok":true,"retention":{...}}
aws logs tail /aws/lambda/pyxis-api-jobs --since 1h --profile pyxis-api | grep retention.
```

`retention.step_done { step, deleted }` is logged for each step; `retention.step_failed` names a
step that failed and why. The schedule can be paused with
`aws scheduler update-schedule` or by setting its state to `DISABLED` in Terraform.

## Rollback

ECR keeps the last five tagged images. Point the HTTP function back at the previous tag:

```bash
aws lambda update-function-code --function-name pyxis-api \
  --image-uri <account-id>.dkr.ecr.sa-east-1.amazonaws.com/pyxis-api:<previous-tag> \
  --region sa-east-1 --profile pyxis-api
```

Migrations only add; a rollback of the code never needs a rollback of the schema.

## Projects and keys in production

The project and key scripts run from the operator's machine with the owner's connection:

```bash
npm ci && npm run build
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s project:create -- --name <name> --origin <origin>
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s key:create -- --project <id> --kind secret
```

A secret key is printed once on stdout; put it straight into the consuming site's secret store.
A revoked key may still be accepted for up to 60 seconds by running instances.

## Dashboard admins

There is no sign-up. Grant an email a project, and it can ask the dashboard for a sign-in code:

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s admin:grant -- --email <email> --project <id>
```

Running it again changes nothing. To end every session of an admin at once, delete their rows
in `admin_sessions` (or the admin, which cascades to sessions and grants).

If no code arrives, look for `auth.code_delivery_failed` in the logs: Resend refused the key or
the sender. `auth.code_rate_limited` means five codes were already sent to that email this
hour. Browsers send a `Secure` cookie to `http://localhost` except Safari, so test the
dashboard locally in Chromium or Firefox.

## Rotating the edge secret

Write the new value in CloudFront's origin header and in `/pyxis-api/app/EDGE_SHARED_SECRET`, then
force new execution environments (`aws lambda update-function-configuration --function-name
pyxis-api --description "rotated <date>"`). Requests answer 403 between the two edits.
