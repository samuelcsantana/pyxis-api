<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/cover-dark.png">
  <img alt="Pyxis — privacy-first product analytics" src=".github/assets/cover-light.png" width="100%">
</picture>

**The API of Pyxis: it receives product analytics events from the browser, answers the dashboard's
queries and erases a person's events on request, without cookies or personal data.**

[![CI](https://github.com/samuelcsantana/pyxis-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/samuelcsantana/pyxis-api/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/samuelcsantana/pyxis-api/graph/badge.svg)](https://codecov.io/gh/samuelcsantana/pyxis-api)
[![CodeQL](https://github.com/samuelcsantana/pyxis-api/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/samuelcsantana/pyxis-api/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/samuelcsantana/pyxis-api/badge)](https://scorecard.dev/viewer/?uri=github.com/samuelcsantana/pyxis-api)
<br>
[![License: MIT](https://img.shields.io/github/license/samuelcsantana/pyxis-api)](LICENSE)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org)
[![API docs](https://img.shields.io/badge/API%20docs-Redoc-0E1A2B)](https://samuelcsantana.github.io/pyxis-api/)

**[API reference](https://samuelcsantana.github.io/pyxis-api/)** — every route, built from
`openapi/openapi.json` on each push to `main`.

**[Pyxis](https://pyxis-analytics.dev)** · **[Live demo](https://demo.pyxis-analytics.dev)** ·
**[Dashboard Storybook](https://samuelcsantana.github.io/pyxis-web/)** ·
**[SDK playground](https://samuelcsantana.github.io/pyxis-sdk/)**

</div>

> **Status:** in production since 2026-10-06 at `api.pyxis-analytics.dev` (AWS Lambda behind
> CloudFront, sa-east-1); `main` is deployed by the deploy script on request (see
> [Deployment](#deployment)).

## Ecosystem

| Repository                                               | Role                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **pyxis-api** (this one)                                 | Ingestion, sign-in, dashboard queries, accounts and billing, erasure, the MCP endpoint |
| [pyxis-sdk](https://github.com/samuelcsantana/pyxis-sdk) | Browser tracker published to npm as `pyxis-analytics`                                  |
| [pyxis-web](https://github.com/samuelcsantana/pyxis-web) | The dashboard and the home page                                                        |
| [pyxis-mcp](https://github.com/samuelcsantana/pyxis-mcp) | MCP server: Claude and other agents read the dashboard's numbers                       |

## Why it exists

Most analytics products ask a site to trade its visitors' privacy for insight: third-party
cookies, fingerprinting, raw IP addresses, full URLs with personal data in them. Pyxis answers the
questions a product team actually asks (which features are used, where requests fail, where a
sign-up funnel loses people, what one person did in order) while storing **no cookie, no IP
address, no user agent and no personal data**. Every rule is enforced in code and covered by
tests, not left to a policy page.

Read more: [why Pyxis was built and what it never stores][post], the introduction post on the
author's blog, also in [Portuguese][post-pt] and [Spanish][post-es].

[post]: https://www.samuelsantana.dev/en/blog/pyxis-analytics-without-cookies-ip-or-personal-data
[post-pt]: https://www.samuelsantana.dev/blog/pyxis-analytics-sem-cookie-sem-ip-sem-dado-pessoal
[post-es]: https://www.samuelsantana.dev/es/blog/pyxis-analytics-sin-cookies-sin-ip-sin-datos-personales

## Features

- **Ingestion.** `POST /v1/batch` takes the SDK's batches with a public key and a per-project
  origin allowlist. Invalid events are refused one by one, a resent event is stored once, and bots
  and traffic from cloud data centers are refused.
- **Privacy on the server.** Values that look like an email, a phone number or a tax id are
  dropped and paths re-templated; device, browser, country and region are derived, then the user
  agent and the address are discarded.
- **Dashboard queries.** Overview, devices, acquisition, features and event properties, requests,
  funnels, timelines, visits, time of day, engagement and live arrivals, over up to 400 days in
  the project's time zone, narrowed by the same visit filters.
- **Sign-in.** A six-digit code by e-mail, exchanged for an opaque session the admin can end one
  by one or everywhere at once.
- **Accounts and billing.** Sign-up on a free plan without a card, the paid plan through Stripe
  Checkout and its webhook, a monthly quota measured daily, projects, keys and people managed by
  the account's owner, and the end of an account in steps.
- **Agents.** Read-only access tokens, an OAuth 2.1 server for the Claude connector and the remote
  MCP endpoint with the sixteen tools of [`pyxis-mcp`](https://github.com/samuelcsantana/pyxis-mcp).
- **A person's data.** Their events erased or exported on request, from the site's backend with a
  secret key; every event deleted after 13 months.
- **E-mails.** Sign-in codes, invitations, the welcome, notices and a weekly digest, each in its
  reader's language.
- **Operator commands.** Suspend, hold, limit or close an account, a project, a person or a token
  from the command line.

Every route, with its parameters and answers, is in the
[API reference](https://samuelcsantana.github.io/pyxis-api/); each feature in full, with its limits
and edge cases, is in [docs/FEATURES.md](docs/FEATURES.md).

## Architecture

```mermaid
flowchart LR
  subgraph Site["Measured site"]
    SDK["pyxis-analytics<br>(browser)"]
    Backend["Site backend"]
  end
  Dashboard["pyxis-web<br>(dashboard)"]
  Claude["Claude · Claude Code<br>(MCP client)"]
  subgraph AWS["AWS · sa-east-1"]
    CF["CloudFront"] --> Lambda["Lambda<br>NestJS + Fastify"]
    Scheduler["EventBridge Scheduler"] --> Jobs["Lambda jobs<br>retention · quota · accounts · exports · icons · digest"]
  end
  DB[("Postgres<br>(Neon)")]
  Mail["Resend or Amazon SES"]
  SDK -- "POST /v1/batch · public key" --> CF
  Dashboard -- "queries · session cookie" --> CF
  Claude -- "POST /mcp · OAuth token" --> CF
  Backend -- "DELETE /v1/subjects/{id} · secret key" --> CF
  Lambda --> DB
  Jobs --> DB
  Lambda -- "sign-in codes" --> Mail
  Jobs -- "weekly digest · quota notices" --> Mail
```

Inside the service, dependencies point inward ([ADR 0002](docs/adr/0002-clean-architecture.md)):

```mermaid
flowchart LR
  infra["infra<br>HTTP, Drizzle, mail, Lambda"] --> usecases["usecases<br>one class per operation"] --> domain["domain<br>entities, rules, ports"]
```

## Tech stack

TypeScript 6 (strict) · NestJS 12 on Fastify 5 · Zod 4 · Drizzle ORM with postgres-js on
PostgreSQL 18 · the MCP TypeScript SDK through `pyxis-mcp` · AWS Lambda behind CloudFront,
provisioned with Terraform · Jest and fast-check · Docker · GitHub Actions with CodeQL,
OpenSSF Scorecard, Dependabot, Codecov and release-please.

## Getting started

Requirements: Node.js 24, npm 11 and Docker.

```bash
git clone git@github.com:samuelcsantana/pyxis-api.git
cd pyxis-api
docker compose up -d --build              # Postgres 18, the migration step, the API
curl http://localhost:3040/health         # {"status":"ok"}
```

The compose stack runs the production image: `migrate` applies the migrations as the owner `pyxis`
and grants the application role `pyxis_app` its row access, then `api` starts as `pyxis_app` on port
3040 with Swagger UI at <http://localhost:3040/docs>. Postgres listens on host port 5446.

To send a first batch, create a project with `project:create`, then post the sample batch with
its public key from an allowed origin:

```bash
npm ci && npm run build
export MIGRATION_DATABASE_URL=postgres://pyxis:pyxis@localhost:5446/pyxis
KEY=$(npm run -s project:create -- --name "Local Demo" --origin http://localhost:5173 | sed -n 's/^public_key=//p')
sed "s/pyxis_pk_LocalDemoKey00000000000000000000/$KEY/" test/fixtures/batch-valid.json |
  curl -X POST http://localhost:3040/v1/batch -H "Origin: http://localhost:5173" \
    -H "Content-Type: text/plain;charset=UTF-8" --data @-
# {"accepted":2,"duplicates":0,"rejected":0}; sending it again: {"accepted":0,"duplicates":2,...}
```

Signing in locally, running the API from source, every setting and every command-line script are
in the [runbook](docs/RUNBOOK.md#local-development).

## Testing

```bash
docker compose up -d db   # the integration tests and the coverage run need Postgres
npm test                  # unit tests only, no database
npm run test:integration  # Drizzle adapters and SQL against a fresh pyxis_test database
npm run test:cov          # unit and integration together, 100% coverage required
npm run test:e2e          # the application over HTTP
npm run test:tooling      # the lint rule and the comment check
```

Coverage must stay at **100% of statements, branches, functions and lines**; CI fails below it.
Database adapters are never mocked: they are tested against a real Postgres, so the coverage gate
counts the unit and integration suites together. The integration and e2e suites connect the way the
Lambda does (`LAMBDA_CLIENT_OPTIONS`: no prepared statements and no type lookup), so a value the
driver cannot parse without that lookup, like a Postgres array, fails a test before it reaches
production; queries return lists as `jsonb`. Files outside the measurement, and why:

| Excluded                    | Reason                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/main.ts`               | Process entry point: wires the app and listens; the e2e suite boots it                          |
| `src/cli/*.main.ts`         | One-line script entry points; the commands and their runner are tested                          |
| `src/lambda/*-entry.ts`     | Lambda entry points: wiring only; the handlers are tested as factories and CI invokes the image |
| `src/export-openapi.ts`     | Command-line entry point; CI runs it and checks its output                                      |
| `src/migrate.ts`            | Command-line entry point; the compose stack and CI's image job run it                           |
| `src/**/*.module.ts`        | Nest module declarations: wiring without logic                                                  |
| `eslint-rules/`, `scripts/` | Tooling outside `src/`, tested on Node's test runner instead                                    |

### Property-based tests

The rules that must hold for anything a stranger can send are also checked with
[fast-check](https://fast-check.dev), over generated inputs instead of chosen examples. The
`*.property.spec.ts` files run with the unit suite (`npm test`), so CI and the pre-commit hook run
them too. They share one fixed seed and run count (`src/test-utils/property-testing.ts`): every run
sees the same inputs, and a failure prints the seed and the shrunk counterexample.

| Module                  | Properties                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateIncomingEvent` | Never throws, for any value; no kept property, campaign or user id value looks personal; nothing outside the domain shape is kept; every sent property and campaign value is kept or reported dropped; the path and route are stored as their own templates |
| `looksPersonal`         | Any text with an email address in it is flagged; ten or more digits written with phone or document separators are flagged and fewer are kept; UUIDs are kept; a number is flagged by the digits of its integer part                                         |
| `templatePath`          | No identifier-shaped segment survives; templating twice changes nothing; a path without identifiers comes back as it was                                                                                                                                    |
| Events CSV              | Any value reads back through a strict RFC 4180 reader, guarded when it starts with a formula character; no field starts a formula; every event is one record with one field per column                                                                      |
| `correctOccurredAt`     | The corrected time is never after reception nor older than the maximum age                                                                                                                                                                                  |
| Date ranges             | `previousRange` has the same length and ends the day before; `checkedRange` accepts exactly the ranges in order, at most 400 days, ending today at the latest, and fails only with its own error                                                            |

### Load test

`scripts/load-test.mts` sends batches to `POST /v1/batch` on a fixed schedule and prints the
status codes, the accepted and rejected events and the p50, p95 and max latency. It exits 1 if any
batch answers other than `202`. It defaults to 1,000 events a minute for 10 minutes, in batches of
20 over 200 visits. Point it at a project made for the test, never at a real site's project:

```bash
node scripts/load-test.mts --endpoint http://localhost:3040 --key pyxis_pk_… \
  --origin http://localhost:3031 [--events-per-minute 1000] [--minutes 10] [--batch-size 20]
```

Measured on 2026-10-07 with the defaults. The production run went through CloudFront to a project
created for it, which was deleted afterwards with its events and key.

| Target                                     | Batches   | Events accepted  | Client p50 / p95 / max | Lambda                                                                                  |
| ------------------------------------------ | --------- | ---------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| Local compose stack                        | 500 × 202 | 10,000 of 10,000 | 25 / 31 / 39 ms        | —                                                                                       |
| `api.pyxis.samuelsantana.dev` (CloudFront) | 500 × 202 | 10,000 of 10,000 | 104 / 140 / 3,935 ms   | 504 invocations, 3 cold starts (init 0.5–0.7 s), p50 18 ms, p95 29 ms, 219 MB, no error |

## Project structure

```text
src/
├── config/            environment validation (Zod)
├── domain/            entities, event validation, the PII barrier, derivations, key formats,
│                      date ranges and the report shapes of the dashboard queries
├── cli/               the project, key and admin scripts, and jobs:run
├── lambda/            the Lambda handlers (HTTP behind CloudFront, migrations, scheduled jobs)
├── usecases/          one class per operation (ingestion, projects, keys, sign-in, queries)
├── infra/database/    Drizzle schema, postgres-js, the migration step, the role check
├── infra/repositories/ Drizzle adapters and the 60-second project key cache
├── infra/queries/     the dashboard queries in SQL and the definitions they share
├── infra/rate-limit/  the per-project limiter
├── infra/mail/        the e-mails (words per language, HTML, plain text) sent through Resend or
│                      Amazon SES, or the log outside production
├── infra/http/        Fastify setup, security headers, request id, errors, health, ingestion,
│                      sign-in and sessions, OAuth, the MCP endpoint, rate limits, OpenAPI
├── shared/            pure utilities
├── test-utils/        fakes for the domain ports
├── main.ts            HTTP entry point
├── migrate.ts         migration entry point
└── export-openapi.ts  writes openapi/openapi.json
test/integration/      adapters against a real Postgres
test/e2e/              the application over HTTP
docker-compose.yml     Postgres 18, the migration step and the API
infra/                 Terraform for the AWS stack (Lambda, CloudFront, ECR, IAM, parameters)
Dockerfile.lambda      the Lambda image; scripts/deploy-lambda.sh ships it
openapi/openapi.json   the published contract, regenerated by npm run openapi:export
api-reference/         the static reference npm run docs:build makes from it (not committed)
eslint-rules/          the local no-comments ESLint rule
scripts/               the comment check for files ESLint does not read
docs/adr/              architecture decision records
osv-scanner.toml       advisories OSV-Scanner and the Scorecard skip, each with its reason
```

Migrations live in `drizzle/`, generated by `npx drizzle-kit generate` from the schema.

## Contract

`openapi/openapi.json` is the source of truth for the other three repositories: the SDK, the
dashboard and the MCP server copy it from `main` and test against it. CI regenerates it on every
pull request and fails when the committed file differs from the code
([ADR 0003](docs/adr/0003-openapi-from-zod.md)).

## Deployment

The API runs on AWS Lambda in sa-east-1 behind CloudFront ([ADR 0006](docs/adr/0006-lambda-behind-cloudfront.md)),
provisioned by the Terraform in `infra/` and shipped by `scripts/deploy-lambda.sh`, which runs the
migrations before updating the HTTP function. Every request must carry the secret header
CloudFront adds; the function's own URL answers 403 without it. The connector's paths (`/mcp`,
`/oauth/*`, `/.well-known/oauth-*`) reach the function only on `api_domain`: on any older name the
distribution still serves, a CloudFront Function answers 404, because a token names one resource
address. CloudWatch alarms e-mail the
operator when requests end in unexpected errors, when the function fails, times out or is
throttled, when the daily jobs fail, skip a day or swallow a failed step, when the database grows, when sign-in codes are being guessed, when the day's sign-up
codes run out, when SES's bounce or complaint rate climbs, when a card starts a second free trial,
and when a refund or an account e-mail fails. Provisioning, deploys, checks, alarms and rollbacks are in the
[runbook](docs/RUNBOOK.md). Merging a pull request never deploys.

## Self-hosting

Nothing in the API needs AWS: `npm start`, or the image the `Dockerfile` builds, serves the same
routes from any machine with Node 24 and a Postgres 18 database. Serve it, and the dashboard, over
HTTPS.

1. **The database.** Create the role the API connects as, without DDL rights
   (`docker/postgres/init/01-app-role.sql` does it for the compose stack), then migrate as the
   owner with `MIGRATION_DATABASE_URL=<owner URL> APP_DB_ROLE=<that role> npm run db:migrate`.
   Migrate again before starting each new version.
2. **The API**, with `NODE_ENV=production` and at least:

   | Variable                                   | Why                                                                                                                                                                                                                                                                                                                                                                                  |
   | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `DATABASE_URL`                             | The application role; ends in `sslmode=verify-full` when the database is on another machine                                                                                                                                                                                                                                                                                          |
   | `DASHBOARD_ORIGIN`                         | The dashboard's exact origin: sign-in calls come from it and every e-mail links to it                                                                                                                                                                                                                                                                                                |
   | `RESEND_API_KEY`, or `MAIL_PROVIDER=ses`   | Sign-in codes go by e-mail, so production does not start without a sender; SES takes the AWS credentials and region of the environment                                                                                                                                                                                                                                               |
   | `MAIL_FROM`                                | A sender on a domain verified in Resend or SES                                                                                                                                                                                                                                                                                                                                       |
   | `CLIENT_IP_HEADER`, behind a reverse proxy | The header the proxy sets to the visitor's address and overwrites on every request, such as `x-real-ip` with nginx's `proxy_set_header X-Real-IP $remote_addr;`. Never a header a client can send or append to, like `X-Forwarded-For`. Unset, the API counts the socket address: behind a proxy every visitor shares it, and the limit of 120 batches a minute refuses real traffic |

   Without `STRIPE_SECRET_KEY` and `SIGNUP_OPEN`, billing and sign-up stay off: nobody can open an
   account, and the projects the operator creates have no plan and no quota. `REMOTE_MCP_OPEN`
   with `API_ORIGIN` turns on the Claude connector, as on the hosted service. Every other setting
   is in the [runbook](docs/RUNBOOK.md#configuration).

3. **The scheduled jobs.** From cron, `npm run -s jobs:run` every day and
   `npm run -s jobs:run -- --job weekly-digest` every week
   ([Scheduled jobs](docs/RUNBOOK.md#scheduled-jobs)).
4. **A project.** `project:create` prints the public key the site embeds, and `admin:grant` lets
   someone sign in to read it ([the scripts](docs/RUNBOOK.md#project-key-and-admin-scripts)).
5. **The tracker.** `init({ key, endpoint: 'https://<your API>' })` in the site, as the
   [pyxis-sdk](https://github.com/samuelcsantana/pyxis-sdk) README shows.
6. **The dashboard.** Build [pyxis-web](https://github.com/samuelcsantana/pyxis-web) with
   `NEXT_PUBLIC_PYXIS_API_URL` set to the API, and serve it at `DASHBOARD_ORIGIN`.

What differs from the hosted service:

- The country and the region of a visit come from CloudFront's viewer headers; without CloudFront
  in front of the API, visits have neither.
- Exports are written to S3 (`EXPORT_BUCKET`, with AWS credentials) and answer 503 without it; an
  export finishes at the next daily run, or at once with `jobs:run -- --job export`.
- The key cache and the rate limits live in each process: several processes multiply the
  per-address limit by their number.
- The alarms are CloudWatch alarms in `infra/`; anywhere else, watch the structured logs
  (`ingest.*`, `auth.*`, `jobs.*`) and the exit code of `jobs:run`.

## Privacy and security

- **No cookie on ingestion, no personal data in events.** The only cookie is the dashboard's
  session. The IP address and the user agent are classified and discarded, never stored, and the
  city is read only for a project that turns it on, off by default
  ([ADR 0054](docs/adr/0054-city-as-a-per-project-option.md)).
- **A second barrier behind the browser's.** A property or campaign value that looks like an
  email, a phone number or a tax id is dropped, a user id that looks personal rejects its event,
  and paths are re-templated with the SDK's rules.
- **Strict headers.** A CSP that loads nothing, no framing, nosniff, no referrer, HSTS and
  `no-store` by default; `X-Forwarded-For` is never trusted for the client address.
- **Limits wherever a stranger can call.** Ingestion per address and per project, counted in
  memory with nothing stored; sign-in, secret keys and access tokens each with their own limit.
- **Nothing confirms what exists.** A project the admin may not read answers the same 404 as one
  that does not exist, and sign-in never says whether an e-mail belongs to an admin.
- **Credentials stored as hashes.** Sign-in codes, sessions, secret keys, access tokens and the
  connector's tokens are kept only as SHA-256 hashes
  ([ADR 0007](docs/adr/0007-email-code-sign-in-with-opaque-sessions.md),
  [ADR 0015](docs/adr/0015-read-only-access-tokens-for-agents.md),
  [ADR 0037](docs/adr/0037-the-api-is-its-own-oauth-server-for-claude.md)).
- **The MCP endpoint only reads.** It takes a bearer token, never the session cookie, refuses a
  request that carries an `Origin` header, and marks the visitors' texts as untrusted for the model
  ([ADR 0038](docs/adr/0038-the-mcp-endpoint-runs-the-tools-inside-the-api.md)).
- **Erasure leaves no trace.** A person's events and the visits they identified in go in one
  statement, and the log keeps only the count
  ([ADR 0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md)).
- **One outbound request, fenced.** Fetching a site's icon is https only, refuses private and
  reserved addresses at every redirect, and accepts PNG, ICO, JPEG, WEBP or GIF, never SVG
  ([ADR 0013](docs/adr/0013-project-icons-fetched-from-the-site.md)).
- **Secrets** live in AWS Parameter Store, never in the repository; secret scanning and push
  protection are on. Vulnerabilities: see [SECURITY.md](SECURITY.md).

Every rule with its numbers (limits, lifetimes, the known false positive) is in
[docs/FEATURES.md](docs/FEATURES.md#privacy-and-security-in-detail).

## Architecture decisions

| ADR                                                                                   | Decision                                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [0001](docs/adr/0001-record-architecture-decisions.md)                                | Record architecture decisions                                              |
| [0002](docs/adr/0002-clean-architecture.md)                                           | Clean Architecture with ports and adapters                                 |
| [0003](docs/adr/0003-openapi-from-zod.md)                                             | Generate the OpenAPI 3.1 contract from Zod                                 |
| [0004](docs/adr/0004-least-privilege-database-roles.md)                               | Least-privilege database roles                                             |
| [0005](docs/adr/0005-per-event-validation.md)                                         | Validate each event of a batch on its own                                  |
| [0006](docs/adr/0006-lambda-behind-cloudfront.md)                                     | Run on Lambda behind CloudFront, with an edge secret                       |
| [0007](docs/adr/0007-email-code-sign-in-with-opaque-sessions.md)                      | Sign admins in with an emailed code and an opaque session cookie           |
| [0008](docs/adr/0008-dashboard-queries-on-raw-events.md)                              | Answer dashboard queries from the raw events, without rollups              |
| [0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md)                      | Erase a person together with the visits they identified in                 |
| [0010](docs/adr/0010-compare-an-unfinished-day-up-to-the-same-time.md)                | Compare an unfinished day up to the same time of day                       |
| [0011](docs/adr/0011-weekly-digest-from-the-jobs-function.md)                         | Send a weekly digest by e-mail from the jobs function                      |
| [0012](docs/adr/0012-session-cookie-set-by-the-dashboard.md)                          | Let the dashboard keep the session in a cookie of its own host             |
| [0013](docs/adr/0013-project-icons-fetched-from-the-site.md)                          | Fetch each project's icon from its site, and keep a copy                   |
| [0014](docs/adr/0014-store-the-region-never-the-city.md)                              | Store the viewer's region, never the city                                  |
| [0015](docs/adr/0015-read-only-access-tokens-for-agents.md)                           | Give agents read-only access tokens, scoped to their admin                 |
| [0016](docs/adr/0016-accounts-own-projects.md)                                        | Accounts own projects; a project without one is the operator's             |
| [0017](docs/adr/0017-monthly-quota-measured-daily.md)                                 | Measure each account's month daily; pause ingestion at 150%                |
| [0018](docs/adr/0018-billing-follows-stripe-through-its-webhook.md)                   | Billing follows Stripe through its webhook, re-reading the subscription    |
| [0019](docs/adr/0019-sign-up-behind-a-switch-and-the-terms-version.md)                | Sign-up behind a switch, tied to the version of the terms accepted         |
| [0020](docs/adr/0020-owners-manage-their-projects-from-the-dashboard.md)              | Owners manage their projects; the operator's stay in the command line      |
| [0021](docs/adr/0021-people-are-counted-across-the-account.md)                        | People are added per project and counted across the account                |
| [0022](docs/adr/0022-an-account-ends-in-steps.md)                                     | An account ends in steps, each done once by the daily job                  |
| [0023](docs/adr/0023-the-welcome-follows-the-subscription.md)                         | The welcome follows the subscription, with the daily job as a fallback     |
| [0024](docs/adr/0024-exports-are-files-with-short-links.md)                           | Exports are files that live a week, reached through links signed on demand |
| [0025](docs/adr/0025-the-owner-closes-the-account-at-once.md)                         | The owner closes the account at once, with a refund inside seven days      |
| [0026](docs/adr/0026-repeated-trials-are-detected-not-blocked.md)                     | Repeated free trials are detected and reported, never blocked              |
| [0027](docs/adr/0027-a-suspension-is-a-mark-not-a-status.md)                          | A suspension is a mark on the account, not a status                        |
| [0028](docs/adr/0028-the-operator-closes-an-account-with-a-chosen-refund.md)          | The operator closes an account with a chosen refund                        |
| [0029](docs/adr/0029-a-deletion-can-be-held.md)                                       | A deletion can be held for a dispute or a legal order                      |
| [0030](docs/adr/0030-the-operator-can-stop-a-person-and-a-token.md)                   | The operator can stop a person and a token                                 |
| [0031](docs/adr/0031-people-without-a-project-are-deleted.md)                         | People left without a project are deleted after thirty days                |
| [0032](docs/adr/0032-a-project-reception-can-be-suspended-alone.md)                   | A project's reception can be suspended on its own                          |
| [0033](docs/adr/0033-a-hold-keeps-everything-it-covers.md)                            | A hold keeps everything it covers, a single project included               |
| [0034](docs/adr/0034-an-account-can-be-exempted-from-the-pause.md)                    | An account can be exempted from the quota pause until a day                |
| [0035](docs/adr/0035-notices-to-every-owner-go-through-the-jobs-function.md)          | Notices to every owner are stored, then sent by the jobs function          |
| [0036](docs/adr/0036-a-larger-plan-is-limits-on-the-account.md)                       | A larger plan is limits on the account, set by the operator                |
| [0037](docs/adr/0037-the-api-is-its-own-oauth-server-for-claude.md)                   | The API is its own OAuth server for Claude                                 |
| [0038](docs/adr/0038-the-mcp-endpoint-runs-the-tools-inside-the-api.md)               | The MCP endpoint runs the tools of pyxis-mcp inside the API                |
| [0039](docs/adr/0039-a-refused-batch-is-readable-by-its-page.md)                      | A refused batch is readable by the page that sent it                       |
| [0040](docs/adr/0040-a-directory-reviewer-signs-in-with-a-code-the-operator-opens.md) | A directory reviewer signs in with a code the operator opens               |
| [0041](docs/adr/0041-a-demo-project-is-filled-with-invented-visits-every-day.md)      | A demo project is filled with invented visits every day                    |
| [0042](docs/adr/0042-a-delivery-delay-is-not-a-wrong-clock.md)                        | A delivery delay is not a wrong clock                                      |
| [0043](docs/adr/0043-the-reception-is-the-arrival-at-the-function-url.md)             | The reception is the arrival at the function URL                           |
| [0044](docs/adr/0044-arrivals-are-counted-by-reception-time.md)                       | Arrivals are counted by reception time, as times not counts                |
| [0045](docs/adr/0045-a-client-that-is-no-browser-is-refused.md)                       | A client that is no browser is refused, not only one that says "bot"       |
| [0046](docs/adr/0046-traffic-from-cloud-data-centers-is-refused.md)                   | Traffic from cloud data centers is refused                                 |
| [0047](docs/adr/0047-a-filter-selects-visits.md)                                      | A filter selects visits, and every report counts their events              |
| [0048](docs/adr/0048-a-free-plan-is-a-status-with-its-own-limits.md)                  | A free plan is a status with its own limits                                |
| [0049](docs/adr/0049-sign-up-without-a-card.md)                                       | Sign-up without a card                                                     |
| [0050](docs/adr/0050-subscribing-from-the-free-plan-and-withdrawing-back-to-it.md)    | Subscribing from the free plan, and withdrawing back to it                 |
| [0051](docs/adr/0051-an-ended-subscription-falls-back-to-the-free-plan.md)            | An ended subscription falls back to the free plan                          |
| [0052](docs/adr/0052-free-accounts-with-no-events-are-deleted.md)                     | Free accounts with no events are deleted after a notice                    |
| [0053](docs/adr/0053-one-free-account-per-mailbox.md)                                 | One free account per mailbox, not per address                              |
| [0054](docs/adr/0054-city-as-a-per-project-option.md)                                 | The city as a per-project option, off by default                           |

## Roadmap

What shipped, release by release, is in the [CHANGELOG](CHANGELOG.md) and the
[GitHub releases](https://github.com/samuelcsantana/pyxis-api/releases).

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Released
under the [MIT License](LICENSE).
