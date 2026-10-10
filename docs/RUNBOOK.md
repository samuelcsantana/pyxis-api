# Runbook

How the API is provisioned, deployed, checked and rolled back on AWS. Account ids, the state
bucket, the distribution id and the database endpoints are written as `<placeholders>`: the
filled-in values live with the operator, never in this public repository.

## What runs where

| Piece                                  | Where                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP function `pyxis-api`              | Lambda in sa-east-1, container image from ECR, behind a public Function URL                                                                                     |
| Migration function `pyxis-api-migrate` | Same image, `dist/lambda/migrate-entry.handler`; invoked by the deploy script                                                                                   |
| CloudFront distribution                | In front of the Function URL; adds the `x-origin-verify` secret header; serves `api.pyxis-analytics.dev` and, while clients move, `api.pyxis.samuelsantana.dev` |
| Configuration                          | Parameter Store under `/pyxis-api/app/` (HTTP) and `/pyxis-api/migrate/` (migrations)                                                                           |
| Database                               | Neon, São Paulo; the HTTP function connects as `pyxis_app` through the pooler, migrations as the owner on the direct host                                       |

| Jobs function `pyxis-api-jobs` | Same image, `dist/lambda/jobs-entry.handler`; run daily at 06:00 UTC by the EventBridge schedule `pyxis-api-retention`, and on Mondays at 11:00 UTC by `pyxis-api-weekly-digest` with `{"job":"weekly-digest"}`, as the application role; reads `/pyxis-api/jobs/` |

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

   `terraform.tfvars` takes the address that receives the alarms (`alert_email`).

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
   `/pyxis-api/jobs/RESEND_API_KEY` (the same value as `/pyxis-api/app/RESEND_API_KEY`; rotate both),
   `/pyxis-api/migrate/MIGRATION_DATABASE_URL` (direct host, owner, `sslmode=verify-full`).
   `DASHBOARD_ORIGIN` and `MAIL_FROM` are plain parameters Terraform sets
   from its variables; the domain of `MAIL_FROM` must be verified in Resend before the first
   sign-in.
7. **Edge secret in CloudFront.** In the distribution's origin, set the `x-origin-verify` custom
   header to the same value as `EDGE_SHARED_SECRET`. Terraform ignores the origin from then on.
   Until both hold the same value, every request through CloudFront answers 403 by design.
8. **Migrate and deploy:** `scripts/deploy-lambda.sh`.
   Then confirm the alarm subscription: AWS emails `alert_email` a link, and the SNS topic
   `pyxis-api-alerts` delivers nothing until it is clicked.
9. **Domain.** Add the certificate's validation CNAMEs (`terraform output
certificate_validation_record`, one per domain) and keep a CAA record allowing `amazon.com` on
   each apex that has CAA records. Once the certificate is issued, set `api_domain_enabled = true`,
   apply, and add a CNAME from `api_domain` and from each of `api_domain_aliases` to `terraform
output cloudfront_domain`.

### Moving the API to another domain

Set the new domain as `api_domain` and keep the current one in `api_domain_aliases`. Terraform
creates a certificate for both before replacing the old one, so:

1. `terraform apply -target=aws_acm_certificate.api` creates the new certificate. It then fails to
   delete the old one, still in use by the distribution (`ResourceInUseException`, after about ten
   minutes of retries); that is expected, and the full apply removes it later.
2. Add the new domain's validation CNAME (`terraform output certificate_validation_record`; the
   names already validated in this account keep their record).
3. Check CAA before ACM does. Every name in the certificate, and each of its parents, must allow
   `amazon.com` or have no CAA records. A parent that is a CNAME answers with its target's CAA
   records: a dashboard name pointing at a host's CNAME can forbid Amazon for the API's name below
   it. Make such a parent an ALIAS or an A record instead. A certificate that failed (`CAA_ERROR`)
   never revalidates: `terraform apply -replace=aws_acm_certificate.api`.
4. Run the full apply: the distribution then answers on every name.
5. Add the new domain's CNAME to the distribution, check `/health` on every name, and only then
   point the clients at it. Drop the old domain from `api_domain_aliases` once nothing calls it.

## Deploy

```bash
scripts/deploy-lambda.sh
```

From a clean working tree on a commit already in `origin/main`. It builds and pushes the image,
runs the migrations, updates the HTTP function only if they succeed, and checks `/health`.
Merging a pull request never deploys.

## Checks after a deploy

```bash
curl -s https://api.pyxis-analytics.dev/health                       # {"status":"ok"}
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
  --cli-read-timeout 910 jobs.json && cat jobs.json   # {"ok":true,"job":"daily","databaseSize":{...},"retention":{...}}
aws logs tail /aws/lambda/pyxis-api-jobs --since 1h --profile pyxis-api | grep -E 'database.size|retention.'
```

The job first logs `database.size { bytes, limitBytes, ratio }`: the size of the database against
the 1 GB of a free Neon branch. A metric filter turns `ratio` into the CloudWatch metric
`Pyxis/DatabaseSizeRatio`, and the alarm `pyxis-api-database-size` fires at 0.7 or more (the
`database_size_alarm_ratio` variable), emailing `alert_email` through `pyxis-api-alerts`. To see
the email arrive without waiting for a full database:

```bash
aws cloudwatch set-alarm-state --alarm-name pyxis-api-database-size --state-value ALARM --state-reason "Checking the alert email" --region sa-east-1 --profile pyxis-api
```

Then `retention.step_done { step, deleted }` is logged for each step; `retention.step_failed`
names a step that failed and why. The schedule can be paused with `aws scheduler update-schedule`
or by setting its state to `DISABLED` in Terraform.

## The weekly digest

On Mondays at 11:00 UTC the schedule `pyxis-api-weekly-digest` invokes the jobs function with
`{"job":"weekly-digest"}`. Every admin who keeps the digest on gets, per project, the week that
ended on Sunday in the project's time zone. To run it by hand:

```bash
aws lambda invoke --function-name pyxis-api-jobs --region sa-east-1 --profile pyxis-api \
  --cli-binary-format raw-in-base64-out --payload '{"job":"weekly-digest"}' \
  --cli-read-timeout 910 digest.json && cat digest.json   # {"ok":true,"job":"weekly-digest",...}
aws logs tail /aws/lambda/pyxis-api-jobs --since 1h --profile pyxis-api | grep -E 'digest\.'
```

Each e-mail Resend accepted logs `digest.sent { projectId, adminUserId, weekStart }` and adds a
row to `digest_deliveries`; a failed one logs `digest.delivery_failed` with Resend's status and is
tried again by the next run. `digest.completed { sent, alreadySent, failed }` closes the run. A run
never sends the same week twice to an admin: to send a week again, delete its row from
`digest_deliveries` first. Without `/pyxis-api/jobs/RESEND_API_KEY` the digest run fails at once
and the daily run is not affected.

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
