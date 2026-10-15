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
   `pyxis-api` prefix and to sa-east-1, and a user `pyxis-api-deployer` that may only assume it.
   The three documents are in [`docs/iam/`](iam/): replace `<account-id>` in each, then create
   them as an administrator (AWS CloudShell keeps the administrator's keys off your machine):

   ```bash
   aws iam create-user --user-name pyxis-api-deployer
   aws iam create-role --role-name pyxis-api-terraform \
     --assume-role-policy-document file://docs/iam/pyxis-api-terraform-trust.json
   aws iam create-policy --policy-name pyxis-api-terraform \
     --policy-document file://docs/iam/pyxis-api-terraform-policy.json
   aws iam attach-role-policy --role-name pyxis-api-terraform \
     --policy-arn arn:aws:iam::<account-id>:policy/pyxis-api-terraform
   aws iam put-user-policy --user-name pyxis-api-deployer --policy-name assume-pyxis-api-terraform \
     --policy-document file://docs/iam/pyxis-api-deployer-assume.json
   ```

   The role trusts the user, so the user comes first; IAM can take a few seconds to see it. Create
   the user's access key in the console and store it with `aws configure --profile
pyxis-api-deployer`; never paste it anywhere else. Terraform runs with that profile and assumes
   the role itself; the scripts and the CLI commands below use a profile that assumes it, in
   `~/.aws/config`:

   ```ini
   [profile pyxis-api]
   role_arn = arn:aws:iam::<account-id>:role/pyxis-api-terraform
   source_profile = pyxis-api-deployer
   region = sa-east-1
   ```

2. **State bucket** `pyxis-api-tfstate-<account-id>` in sa-east-1, versioned, encrypted, public
   access blocked, created outside Terraform.
3. **Local Terraform files**, both ignored by git:

   ```bash
   cp infra/backend.example.hcl infra/backend.hcl          # fill in <account-id>
   cp infra/terraform.tfvars.example infra/terraform.tfvars
   ```

   `terraform.tfvars` takes the role, the API's domain (`api_domain`), the dashboard's origin
   (`dashboard_origin`), the sender of the e-mails (`mail_from`) and the address that receives the
   alarms (`alert_email`). None of them has a default: the first apply requests the certificate
   for `api_domain`, and the API accepts sign-ins from `dashboard_origin` only. `support_email` is
   optional: the address the account e-mails (quota notices) name and send replies to.

4. **Application role.** As the database owner (Neon's SQL editor or `psql`), create the role the
   API connects as. Create it in SQL rather than in Neon's roles page, which would make it a member
   of `neon_superuser`:

   ```sql
   CREATE ROLE pyxis_app WITH LOGIN PASSWORD '<a long random password>';
   ```

   The migrations refuse to run without it, and grant it row access to every table.

5. **First image.** The functions need an image to point at:

   ```bash
   aws ecr create-repository --repository-name pyxis-api --region sa-east-1 --profile pyxis-api
   scripts/deploy-lambda.sh --image-only     # prints the tag; put it in terraform.tfvars
   ```

6. **Apply**, letting Terraform own the repository first:

   ```bash
   cd infra
   export AWS_PROFILE=pyxis-api-deployer
   terraform init -backend-config=backend.hcl
   terraform import aws_ecr_repository.api pyxis-api
   terraform plan -out plan.tfplan && terraform apply plan.tfplan && rm plan.tfplan
   terraform output -raw cloudfront_domain
   unset AWS_PROFILE
   ```

7. **Parameter values**, in the Parameter Store console (Terraform created placeholders and never
   reads the values back): `/pyxis-api/app/DATABASE_URL` (pooler host, `pyxis_app`,
   `sslmode=verify-full`), `/pyxis-api/app/EDGE_SHARED_SECRET` (a long random value),
   `/pyxis-api/app/RESEND_API_KEY` (a Resend key allowed to send only),
   `/pyxis-api/jobs/DATABASE_URL` (the same value as `/pyxis-api/app/DATABASE_URL`),
   `/pyxis-api/jobs/RESEND_API_KEY` (the same value as `/pyxis-api/app/RESEND_API_KEY`; rotate both),
   `/pyxis-api/migrate/MIGRATION_DATABASE_URL` (direct host, owner, `sslmode=verify-full`).
   `DASHBOARD_ORIGIN` and `MAIL_FROM` are plain parameters Terraform sets from its variables, for
   the HTTP and the jobs functions; the e-mails link to `DASHBOARD_ORIGIN` and load their logo
   from it, and the domain of `MAIL_FROM` must be verified in Resend before the first sign-in.
8. **Edge secret in CloudFront.** In the distribution's origin, set the `x-origin-verify` custom
   header to the same value as `EDGE_SHARED_SECRET`. Terraform ignores the origin from then on.
   Until both hold the same value, every request through CloudFront answers 403 by design.
9. **Migrate and deploy.** `api_domain` does not answer yet, so point the script's closing health
   check at the distribution:

   ```bash
   API_HOST=<cloudfront_domain output> scripts/deploy-lambda.sh
   ```

   From the next deploy on, `API_HOST=<api_domain>`. Then confirm the alarm subscription: AWS
   emails `alert_email` a link, and the SNS topic `pyxis-api-alerts` delivers nothing until it is
   clicked.

10. **Domain.** Add the certificate's validation CNAMEs (`terraform output
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
an allowed origin must store a row whose `country`, `region` and `region_name` are filled, which
proves `CloudFront-Viewer-Country` and `CloudFront-Viewer-Country-Region(-Name)` arrive. Send it
from a browser outside AWS: CloudFront sets no region for requests from AWS's own network.

## Alarms

Every alarm e-mails `alert_email` through the SNS topic `pyxis-api-alerts`, once when it fires
and once when it clears.

| Alarm                                     | Fires when                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `pyxis-api-unhandled-errors`              | 5 or more requests end in an unexpected 500 within five minutes            |
| `pyxis-api-function-errors`               | 3 or more HTTP function invocations fail or time out in five minutes       |
| `pyxis-api-function-throttles`            | Any request is throttled in five minutes (reserved concurrency full)       |
| `pyxis-api-database-size`                 | The database passes 70% of the 1 GB of a free Neon branch                  |
| `pyxis-api-rejected-sign-in-codes`        | 20 wrong sign-in codes within 15 minutes                                   |
| `pyxis-api-refused-sign-in-code-requests` | 5 refused code requests within an hour                                     |
| `pyxis-api-repeated-trials`               | A card starts a free trial already started by another account              |
| `pyxis-api-refund-failures`               | A refund fails when an account is closed (refund by hand in Stripe)        |
| `pyxis-api-account-notice-failures`       | An end-of-access, reminder or deletion e-mail fails (tried again tomorrow) |

The refund and account e-mail alarms count `accounts.refund_failed` and `accounts.notice_failed`
in both functions' logs; `account:close` runs on the operator's machine, so its failures show in
its own output instead. The thresholds are Terraform variables. All of them watch sa-east-1, so an outage before the
function (DNS, the certificate, CloudFront itself) raises none; an external uptime check of
`/health` would cover it. To see an alert e-mail arrive without breaking anything:

```bash
aws cloudwatch set-alarm-state --alarm-name pyxis-api-unhandled-errors --state-value ALARM --state-reason "Checking the alert email" --region sa-east-1 --profile pyxis-api
```

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

After measuring the accounts, the job runs the account lifecycle and logs
`accounts.lifecycle_done` with what it did: subscriptions reconciled with Stripe, keys revoked at
the end of access, end and reminder e-mails, accounts deleted thirty days after the end, abandoned
sign-ups removed, and people left without any project or account: `projectlessMarked` counts the
ones found alone for the first time, `projectlessRemoved` the ones deleted thirty days after that
mark (`admin_users.projectless_since`; a person who gets a project back loses the mark). Look for `accounts.reconcile_failed` (Stripe could not be read for one account),
`accounts.notice_failed` (an e-mail that will be tried again tomorrow), and
`accounts.deletion_failed` or `accounts.incomplete_removal_failed`, which also fail the invocation
so the error alarm fires; the next run continues from what is left. Reconciliation needs
`/<project>/jobs/STRIPE_SECRET_KEY`, the same value as `/<project>/app/STRIPE_SECRET_KEY`.

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

## E-mail through Amazon SES

The API sends e-mail through Resend by default. To send through Amazon SES in the same region:

1. Give the Terraform role the SES statements of `docs/iam/pyxis-api-terraform-policy.json`
   (a new version of its managed policy).
2. Set `ses_domain` (the domain of `mail_from`) in `terraform.tfvars`, keep `mail_provider =
"resend"`, and apply. Terraform creates the domain identity, a bounce subdomain
   (`bounce.<domain>`) as its MAIL FROM, the account-level suppression of bounces and complaints,
   and the permission to send for the HTTP and jobs functions.
3. Add the records of `terraform output ses_dns_records` in DNS: three DKIM CNAMEs, and the MX and
   SPF TXT of the bounce subdomain. Leave the domain's own SPF alone: two SPF records on one name
   invalidate both, and the bounce subdomain needs none at the apex. Wait until
   `aws sesv2 get-email-identity --email-identity <domain>` shows `VerifiedForSendingStatus: true`.
4. New accounts start in the SES sandbox (200 e-mails a day, only to verified addresses). Ask for
   production access (`aws sesv2 put-account-details --production-access-enabled
--mail-type TRANSACTIONAL ...` or the console) and wait for the answer.
5. Set `mail_provider = "ses"`, apply, and deploy so the functions read the new parameter at cold
   start. Request a sign-in code for a test inbox and check the headers: `DKIM: PASS` for the
   domain and the return path on `bounce.<domain>`.

Bounces and complaints are suppressed for the whole account, so an address that bounced is not
tried again. To go back, set `mail_provider = "resend"`, apply and deploy: the Resend key
parameters stay in place.

## Billing and sign-up

Billing stays off until the two Stripe parameters hold real values, and sign-up stays closed until
two settings are set. In this order:

1. In Stripe, create a restricted key with write access to Checkout Sessions, Customer portal,
   Customers, Subscriptions and Refunds, and read access to Prices and Invoices (an owner who
   closes the account within seven days of the first payment is refunded with it; if a closure
   logs `accounts.refund_failed`, the key's request log in Stripe names the permission missing,
   and the refund is made by hand), and a webhook endpoint for
   `https://<api_domain>/v1/billing/stripe/webhook` with the events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. The prices are
   found by their lookup keys, `pyxis_monthly_brl` and `pyxis_yearly_brl`.
2. Paste the key into `/<project>/app/STRIPE_SECRET_KEY` and `/<project>/jobs/STRIPE_SECRET_KEY`,
   and the endpoint's signing secret into `/<project>/app/STRIPE_WEBHOOK_SECRET` (Parameter Store,
   SecureString; Terraform created them with a placeholder and never reads them back). The key
   needs read access to Subscriptions too, for the daily reconciliation. Deploy, or wait for new containers, so the
   function reads them.
3. Publish the terms, then set `terms_version` (the version the dashboard shows, such as
   `2026-11-01`), `terms_url` (where they are published) and `signup_open = true` in
   `terraform.tfvars`, apply, and deploy so the functions read them at cold start.
   `GET /v1/auth/sign-up` answers `{"open":true,"terms_version":"…","terms_url":"…"}` once they are
   read.

To close sign-up again, set `signup_open = false`, apply and deploy; accounts
already created keep working. A new version of the terms is the same change with a new
`terms_version`: a page still showing the old one is refused with `409 terms_outdated`.

### Repeated free trials

When a card that already started a free trial in another account starts one again, the HTTP
function logs `billing.repeated_trial { accountId, earlierAccountIds }` and the alarm
`pyxis-api-repeated-trials` fires. Nothing is done automatically: the customer keeps the trial
Checkout promised. To look into it:

```bash
aws logs tail /aws/lambda/pyxis-api --since 1d --profile pyxis-api | grep -E 'billing.repeated_trial'
npm run -s account:show -- --account <accountId>        # the new account
npm run -s account:show -- --account <earlierAccountId> # each earlier one
```

An earlier account answered with "No account has this id." was closed and deleted; Stripe still
has its customer and subscription. Decide by hand under the terms (for example, write to the
owner, or close the new account). `billing.repeated_trial_check_failed` means the check itself
failed for an event; the event was applied anyway. The cards are deleted twelve months after
their trial started.

## Abuse

The terms let the operator act on an account that abuses the service, from the mildest measure up.
Each command runs from the operator's machine with the owner's connection, like the project
scripts, and prints `key=value` lines.

### Suspending an account

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s account:suspend -- --account <id> --reason '<what was seen, as written to the owner>'
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s account:resume -- --account <id>
```

Within a minute (each instance caches the state for 60 seconds), the account's batches are
answered `403 account_suspended`, which the tracker drops, and its project screens, its read-only
tokens and the owner's changes to projects, keys and people answer `403 account_suspended` too.
Sign-in, the account and its reason in the dashboard, the billing portal, closing the account,
exports and the secret-key erasure and export of a person's events stay open. The subscription,
the daily job and the thirteen-month retention are not touched. Nothing is e-mailed: write to
the owner with the reason, what was suspended, what to do and how to contest. Writing the reason
again keeps the moment of the first suspension; keys and tokens revoked meanwhile stay revoked
after `account:resume`.

### Suspending the reception of one project

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s project:suspend -- --project <id> --reason '<what was seen, as written to the owner>'
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s project:resume -- --project <id>
```

The lighter measure, for one site of an account (for example events carrying e-mail addresses).
Within a minute the project's batches are answered `403 project_suspended`, which the tracker
drops; its screens, settings, exports and people stay open, and the rest of the account goes on.
The dashboard shows the suspension to everyone who reads the project and the reason to the
account's owner. Works on the operator's own projects too. Billing is not touched. Nothing is
e-mailed: write to the owner with the reason and how to contest. When the whole account is
suspended as well, its batches are answered `account_suspended`.

### Closing an account as the operator

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' STRIPE_SECRET_KEY='<the restricted key>' \
  npm run -s account:close -- --account <id> --reason '<what was seen, as written to the owner>' --refund prorata
```

`--refund full` refunds everything the latest paid invoice paid (a first payment inside the
seven-day withdrawal period), `prorata` the whole days left of its period, counted from the start
of the suspension when the account is suspended, and `none` nothing (a repeated free trial ended
before any charge). The subscription is cancelled at once, the keys are revoked in the same
transaction and the data is deleted thirty days later; the next daily job e-mails the owner the
end of access and the date. If Stripe cannot cancel, nothing is closed; if only the refund fails,
the account is closed, the output says so, and the refund is made by hand in Stripe. The reason is
printed, not stored: write to the owner with it.

### Holding a deletion

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s account:hold -- --account <id> --reason '<the dispute or the order>'
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s account:release -- --account <id>
```

While held, the daily job neither reminds nor deletes the account (nor removes it as an abandoned
sign-up), and its owner cannot delete its projects (`409 deletion_on_hold`); the dashboard shows
the hold, not the reason. Retention of events older than thirteen months and the erasure of a
person's events go on. Releasing the hold of an account ended more than thirty days ago lets the
next daily run delete it.

### Stopping one person or one token

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s admin:suspend -- --email <email>
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s admin:resume -- --email <email>
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s token:revoke -- --token <id>
```

`admin:suspend` ends every live session and revokes every token of the person at once, keeps
their grants, and keeps them out: no sign-in code is sent (the answer is the usual 202), a code
sent before is refused, and a session that survived is refused too. `admin:resume` lets them sign
in again; the old sessions and tokens stay ended. `token:revoke` takes the id the dashboard's
Tokens panel shows; for a project key, use `key:revoke`.

## Exports

Owners export a project's events to a compressed CSV. Terraform creates the private bucket
`<project>-exports-<account-id>` (public access blocked, encrypted, files under `exports/` deleted
after `export_file_days`, 7 by default), lets the jobs function write there and the HTTP function
read (to sign download links) and invoke the jobs function, and writes `EXPORT_BUCKET` and
`JOBS_FUNCTION_NAME` to the parameters. The Terraform role needs the `ExportsBucket` statement of
`docs/iam/pyxis-api-terraform-policy.json` (a new version of its managed policy) before the
first apply.

A request is handed to the jobs function at once (`{"job":"export","exportId":"…"}`); one that
waited more than fifteen minutes is run by the next daily job. Logs: `exports.done { exportId,
events }`, `exports.failed` (the export is marked failed and the invocation fails),
`exports.dispatch_failed` (the daily job will run it). To run one by hand:

```bash
aws lambda invoke --function-name pyxis-api-jobs --region sa-east-1 --profile pyxis-api   --cli-binary-format raw-in-base64-out --payload '{"job":"export","exportId":"<id>"}' out.json
```

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

To remove a project for good, revoke its keys first (so its site stops sending), then delete it.
The name must be written exactly as the project's, which guards against a copied wrong id; the
command prints the events and keys it removed, and there is no undo:

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s project:delete -- --project <id> --confirm-name '<name>'
```

To see how much each project used in a month (events and visits received, by calendar month in
UTC; the current month when `--month` is left out), for example to compare with a plan's limit:

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s usage:report -- --month 2026-11
```

## Dashboard admins

There is no sign-up. Grant an email a project, and it can ask the dashboard for a sign-in code:

```bash
MIGRATION_DATABASE_URL='<owner connection, direct host>' npm run -s admin:grant -- --email <email> --project <id>
```

Running it again changes nothing. To end every session and token of an admin at once and keep
them out, use `admin:suspend` (see "Stopping one person or one token").

If no code arrives, look for `auth.code_delivery_failed` in the logs: Resend refused the key or
the sender. `auth.code_rate_limited` means five codes were already sent to that email this
hour. Browsers send a `Secure` cookie to `http://localhost` except Safari, so test the
dashboard locally in Chromium or Firefox.

## Rotating the edge secret

Write the new value in CloudFront's origin header and in `/pyxis-api/app/EDGE_SHARED_SECRET`, then
force new execution environments (`aws lambda update-function-configuration --function-name
pyxis-api --description "rotated <date>"`). Requests answer 403 between the two edits.
