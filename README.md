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
<br>
[![License: MIT](https://img.shields.io/github/license/samuelcsantana/pyxis-api)](LICENSE)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org)
[![API docs](https://img.shields.io/badge/API%20docs-Redoc-0E1A2B)](https://samuelcsantana.github.io/pyxis-api/)

**[API reference](https://samuelcsantana.github.io/pyxis-api/)** — every route, built from
`openapi/openapi.json` on each push to `main`.

**[Dashboard Storybook](https://samuelcsantana.github.io/pyxis-web/)** ·
**[SDK playground](https://samuelcsantana.github.io/pyxis-sdk/)**

</div>

> **Status:** early development. Ingestion, dashboard sign-in, every dashboard query, erasure and
> retention work end to end on the local stack; the first apply to AWS is next (see
> [Roadmap](#roadmap)).

## Ecosystem

| Repository                                               | Role                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| **pyxis-api** (this one)                                 | Ingestion, dashboard sign-in and queries, erasure, retention    |
| [pyxis-sdk](https://github.com/samuelcsantana/pyxis-sdk) | Browser tracker published to npm as `pyxis-analytics`           |
| [pyxis-web](https://github.com/samuelcsantana/pyxis-web) | The dashboard: overview, funnels, features, requests, timelines |

## Why it exists

Most analytics products ask a site to trade its visitors' privacy for insight: third-party
cookies, fingerprinting, raw IP addresses, full URLs with personal data in them. Pyxis answers the
questions a product team actually asks (which features are used, where requests fail, where a
sign-up funnel loses people, what one person did in order) while storing **no cookie, no IP
address, no user agent and no personal data**. Every rule is enforced in code and covered by
tests, not left to a policy page.

## Features

Shipping now:

- Health endpoint, strict security headers and a request id on every response
- OpenAPI 3.1 document generated from the routes' own Zod schemas, with Swagger UI outside
  production
- PostgreSQL through Drizzle, with migrations run by the owner role and the API connected as a
  least-privilege role that can read and write rows but never change the schema
- `POST /v1/batch`: batched ingestion with a public project key and a per-project origin
  allowlist, as `text/plain` (no CORS preflight, `sendBeacon`-friendly) or `application/json`.
  Invalid events are rejected one by one while the rest of the batch is stored
  ([ADR 0005](docs/adr/0005-per-event-validation.md)); a resent event is a duplicate, never stored
  twice; bots are recognized and rejected
- A server-side barrier that drops any property or campaign value that looks like an email, a
  phone number or a tax id, and re-templates paths
- Device, browser, operating system, channel and country derived on the server; the user agent
  and the address are read, classified and discarded
- Dashboard sign-in with a six-digit code sent by email, exchanged for an opaque session in an
  `HttpOnly` cookie that is checked on every request and revoked at sign-out; `GET /v1/me` lists
  the admin's projects, each with when its first and its latest events happened (null before
  any), so the dashboard can tell a project still waiting for its first event from a quiet
  period. There is no sign-up: `admin:grant` is the only way in
  ([ADR 0007](docs/adr/0007-email-code-sign-in-with-opaque-sessions.md))
- A branded sign-in email with a plain-text twin: the code first in the subject and in the
  hidden inbox preview, then in a large monospace block a double-click copies whole; how long it
  lasts, that it works once, never to share it, and what to do if the sign-in was not yours.
  Table layout with inline styles for every client, light and dark through `color-scheme` and
  `prefers-color-scheme`, `lang` and presentation-only tables for screen readers; every value
  HTML-escaped, no tracking pixel and no tracked links. Its only image is the dashboard's PNG
  logo (`https://pyxis.samuelsantana.dev/email/pyxis-logo.png`), and its words live in a typed
  message table in English and Brazilian Portuguese. The dashboard sends its own language as an
  optional `locale` in `POST /v1/auth/request-code` (`{"email":…,"locale":"pt-BR"}`), matched
  on the language (`pt-PT` gets pt-BR); no `locale`, or one the API has no email for, gets
  English, so sign-in never fails over a language
- Dashboard queries over any range of up to 400 days in the project's time zone:
  `GET /v1/projects/{projectId}/overview` (visits, identified users, conversions and failed
  writes against the previous period, daily activity of both periods, top pages and events; a
  range that ends today is compared with the previous period up to the same time of day, and the
  answer says which time that was:
  [ADR 0010](docs/adr/0010-compare-an-unfinished-day-up-to-the-same-time.md)),
  `/devices` (device type, browser, system and country, top five and "other") and
  `/acquisition` (visits per day and channel, sources and campaigns with conversions and ad
  clicks); wherever
  conversions are counted, both the conversion events and the converting visits (visits that
  sent the conversion event at least once) are given, so a conversion rate never passes 100 %,
  `/features?kind=events|screens` (the most used named events or screens, with daily counts) and
  `/features/properties?name=` (how one named event's property values break down: per key, the
  ten most frequent values with their count and visits, and the count of the rest) and
  `/requests?screen=&kind=&route=` (writes per route: failures, statuses, median and 95th
  percentile duration, the screens they came from and the latest failures with their error code,
  plus the calls of every day by status class, and with `route` that route day by day; with
  `kind=reads`, the failed reads instead, counted without a rate because sites send a read only
  when it fails) and
  `/funnel?mode=visit|user&steps=` (how many visits or people reached each of 2 to 8 ordered steps,
  a person's anonymous steps counting once they identify, with the median time from each step
  to the next and through the whole funnel), `/funnel/subjects?step=&outcome=reached|dropped`
  (the visits, or identified people, who reached one step or reached the one before and never
  it, newest first with a cursor) and
  `/timeline?user_id=|session_id=` (the visits of a person, the anonymous one they identified in
  included, or of one visit, newest first, 20 per page, with every event and the first id the
  visit was identified with, so a visit opened by its id leads to its person) and
  `/visits` (the visits of the range, newest first, 50 per page with a cursor, each with its
  entry page, page views, first named events, failed requests and the source and campaign it
  came from, plus the total of matching visits; filtered by up to three pages it viewed, a star
  matching any characters, a named event with an optional property value, channel, device,
  country, source, campaign, whether it was identified, a request route (`POST /orders/:id`) and
  whether a request, or a request to that route, failed; a visit is one browser tab, and nothing
  links two of them) and
  `/settings` (read-only: time zone, conversion event, allowed origins, first and latest event,
  how many months events are kept, the live public keys, and when each live secret key was
  created; a secret key never leaves the API, not even as its hash) and
  `/time-of-day` (for each weekday, Monday first, and each local hour, the visits whose first page
  view happened then; the grid adds up to the visits of the range). A project
  the admin may not read answers the same 404 as one that does not exist
  ([ADR 0008](docs/adr/0008-dashboard-queries-on-raw-events.md))

- `DELETE /v1/subjects/{userId}` erases a person's events, including the anonymous part of the
  visit they identified in, and `GET /v1/subjects/{userId}/events` exports them, both from the
  site's backend with a secret project key
  ([ADR 0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md))

- A daily job deletes events older than 13 months, then expired dashboard sessions and sign-in
  codes; each step logs its count, and a failed step fails the run so the scheduler retries

## Architecture

```mermaid
flowchart LR
  subgraph Site["Measured site"]
    SDK["pyxis-analytics<br>(browser)"]
    Backend["Site backend"]
  end
  Dashboard["pyxis-web<br>(dashboard)"]
  subgraph AWS["AWS · sa-east-1"]
    CF["CloudFront"] --> Lambda["Lambda<br>NestJS + Fastify"]
  end
  DB[("Postgres<br>(Neon)")]
  SDK -- "POST /v1/batch · public key" --> CF
  Dashboard -- "queries · session cookie" --> CF
  Backend -- "DELETE /v1/subjects/{id} · secret key" --> CF
  Lambda --> DB
```

Inside the service, dependencies point inward ([ADR 0002](docs/adr/0002-clean-architecture.md)):

```mermaid
flowchart LR
  infra["infra<br>HTTP, Drizzle, mail, Lambda"] --> usecases["usecases<br>one class per operation"] --> domain["domain<br>entities, rules, ports"]
```

## Tech stack

TypeScript 6 (strict) · NestJS 12 on Fastify 5 · Zod 4 · Drizzle ORM with postgres-js on
PostgreSQL 18 · AWS Lambda behind CloudFront, provisioned with Terraform · Jest · Docker · GitHub
Actions with CodeQL, Dependabot, Codecov and release-please.

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

To send a first batch, create a project with the scripts below, then post the sample batch with
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

### Project, key and admin scripts

They connect with `MIGRATION_DATABASE_URL` (or `DATABASE_URL`) and print `key=value` lines; run
`npm run build` first. `-s` keeps npm's banner out of the output.

| Command                                                                                                                                         | What it does                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run -s project:create -- --name <name> --origin <origin>… [--timezone <IANA zone>] [--conversion-event <event>]`                           | Creates a project and its first public key, printed for the site to embed                 |
| `npm run -s project:update -- --project <id> [--origin <origin>…] [--timezone <zone>] [--conversion-event <event> \| --clear-conversion-event]` | Replaces the settings it is given; `--origin` replaces the whole list                     |
| `npm run -s key:create -- --project <id> --kind <public\|secret>`                                                                               | Prints the new key alone on stdout; a secret key is shown only then and stored as a hash  |
| `npm run -s key:revoke -- --key-id <id>`                                                                                                        | Revokes a key; running instances may accept it for up to 60 seconds from their cache      |
| `npm run -s admin:grant -- --email <email> --project <id>`                                                                                      | Creates the admin when needed and lets them sign in to the dashboard and read the project |

An origin is written exactly as browsers send it: scheme, host and a non-default port, with no
path or trailing slash (`https://shop.example.com`, `http://localhost:5173`).

To sign in as an admin locally, grant yourself a project, then exchange the code the API logs
(outside production codes are logged, never emailed). The compose stack accepts sign-in calls
from `http://localhost:3000`, where the dashboard runs:

```bash
npm run -s admin:grant -- --email you@example.com --project <id>
curl -X POST http://localhost:3040/v1/auth/request-code -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'          # 202
docker compose logs api | grep -A2 mail.sign_in_code                           # the code
curl -i -X POST http://localhost:3040/v1/auth/verify-code -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com","code":"<code>"}'
# 200 and Set-Cookie: pyxis_session=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

To run the API from source instead, keep only the database in Docker:

```bash
docker compose up -d db
npm ci && npm run build
MIGRATION_DATABASE_URL=postgres://pyxis:pyxis@localhost:5446/pyxis APP_DB_ROLE=pyxis_app npm run db:migrate
DATABASE_URL=postgres://pyxis_app:pyxis_app@localhost:5446/pyxis npm start
```

Configuration is validated at boot ([`src/config/env.schema.ts`](src/config/env.schema.ts)):

| Variable                 | Default                             | Meaning                                                                                                                                                         |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                   | `3040`                              | HTTP port                                                                                                                                                       |
| `NODE_ENV`               | `development`                       | `development`, `production` or `test`                                                                                                                           |
| `SWAGGER_ENABLED`        | unset                               | `true`/`false`; unset means on everywhere except production                                                                                                     |
| `DATABASE_URL`           | required                            | The API's connection, as the application role                                                                                                                   |
| `MIGRATION_DATABASE_URL` | unset                               | The owner's connection, used only by `npm run db:migrate`                                                                                                       |
| `APP_DB_ROLE`            | unset                               | The role granted row access after each migration (`pyxis_app`)                                                                                                  |
| `CLIENT_IP_HEADER`       | unset                               | A header the edge overwrites with the client address, for the per-address limit (`cloudfront-viewer-address` behind CloudFront); unset means the socket address |
| `DASHBOARD_ORIGIN`       | unset; required in production       | The only origin allowed to call the sign-in routes and read `/v1/me` with credentials; unset refuses them all                                                   |
| `SESSION_COOKIE_DOMAIN`  | unset                               | `Domain` of the session cookie (`pyxis.samuelsantana.dev`, so the dashboard's server receives it); unset means the API host only                                |
| `RESEND_API_KEY`         | unset; required in production       | Sends the sign-in codes; without it, outside production, codes are logged instead                                                                               |
| `MAIL_FROM`              | `Pyxis <noreply@samuelsantana.dev>` | Sender of the sign-in emails; its domain must be verified in Resend                                                                                             |

In production every database URL ends in `sslmode=verify-full`. The production requirements
apply to the API process only: the migration and the scripts validate the shared settings.

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
counts the unit and integration suites together. Files outside the measurement, and why:

| Excluded                    | Reason                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/main.ts`               | Process entry point: wires the app and listens; the e2e suite boots it                          |
| `src/cli/*.main.ts`         | One-line script entry points; the commands and their runner are tested                          |
| `src/lambda/*-entry.ts`     | Lambda entry points: wiring only; the handlers are tested as factories and CI invokes the image |
| `src/export-openapi.ts`     | Command-line entry point; CI runs it and checks its output                                      |
| `src/migrate.ts`            | Command-line entry point; the compose stack and CI's image job run it                           |
| `src/**/*.module.ts`        | Nest module declarations: wiring without logic                                                  |
| `eslint-rules/`, `scripts/` | Tooling outside `src/`, tested on Node's test runner instead                                    |

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
├── cli/               the project, key and admin scripts
├── lambda/            the Lambda handlers (HTTP behind CloudFront, migrations, daily jobs)
├── usecases/          one class per operation (ingestion, projects, keys, sign-in, queries)
├── infra/database/    Drizzle schema, postgres-js, the migration step, the role check
├── infra/repositories/ Drizzle adapters and the 60-second project key cache
├── infra/queries/     the dashboard queries in SQL and the definitions they share
├── infra/rate-limit/  the per-project limiter
├── infra/mail/        the sign-in email (words per language, HTML, plain text) sent through Resend,
│                      or the log outside production
├── infra/http/        Fastify setup, security headers, request id, errors, health, ingestion,
│                      sign-in and sessions, rate limits, OpenAPI
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
```

Migrations live in `drizzle/`, generated by `npx drizzle-kit generate` from the schema.

## Contract

`openapi/openapi.json` is the source of truth for the other two repositories: the SDK and the
dashboard copy it from `main` and test against it. CI regenerates it on every pull request and
fails when the committed file differs from the code ([ADR 0003](docs/adr/0003-openapi-from-zod.md)).

## Deployment

The API runs on AWS Lambda in sa-east-1 behind CloudFront ([ADR 0006](docs/adr/0006-lambda-behind-cloudfront.md)),
provisioned by the Terraform in `infra/` and shipped by `scripts/deploy-lambda.sh`, which runs the
migrations before updating the HTTP function. Every request must carry the secret header
CloudFront adds; the function's own URL answers 403 without it. Provisioning, deploys, checks and
rollbacks are in the [runbook](docs/RUNBOOK.md). Merging a pull request never deploys.

## Privacy and security

- No cookies on ingestion (the only cookie is the dashboard's session), no personal data in
  events, IP address and user agent never stored
- A server-side barrier drops any property or campaign value that looks personal: an email
  address, ten or more digits written only with phone or document separators (phone numbers, CPF,
  CNPJ), or a number with ten or more digits in its integer part. A user id that looks personal
  rejects the whole event. UUIDs are always kept. Known false positive, accepted: a 13-digit epoch
  in milliseconds sent as a property is dropped, so send durations, not timestamps
- Paths are re-templated on the server with the SDK's rules (UUIDs, numbers, long digit runs and
  email addresses become `:id`), a second layer behind the browser's
- Device, browser and operating system are classified by own code from the user agent and client
  hints, then the user agent is discarded; the country comes from CloudFront, never from the IP
- Strict response headers: a CSP that loads nothing, no framing, nosniff, no referrer, HSTS and
  `no-store` by default
- `X-Forwarded-For` is never trusted for the client address
- Ingestion is rate-limited per client address (120 batches a minute) and per project (3,000 a
  minute), in memory per execution environment: no counter, not even a hash of an address, is
  stored. The function's reserved concurrency bounds the global worst case
- A resolved project key is cached for 60 seconds per execution environment, so revoking a key
  takes up to a minute to take effect everywhere
- The ingestion route answers CORS with the project's allowed origin only, never with
  credentials; a request from another origin gets 403 and nothing it can read
- A dashboard query for a project the admin was not granted answers exactly like one for a
  project that does not exist (404 `not_found`), so the API never confirms that a project exists
- Dashboard sign-in never says whether an email belongs to an admin (always 202, empty body).
  Codes and session tokens are stored only as SHA-256 hashes; a code allows five guesses and one
  use, and expires in 10 minutes. Sessions end after 7 days, after 24 hours idle or at sign-out
- The sign-in routes accept only the dashboard's `Origin`, on top of a `SameSite=Lax` cookie,
  and allow five requests per address every fifteen minutes on each route
- Erasure deletes the person's events and every visit they identified in, in one statement, and
  logs only how many rows went, never the user id. Secret keys are looked up by hash on every call
  (no cache, so revoking one takes effect at once) and limited to 60 calls a minute each
- Secrets live in AWS Parameter Store, never in the repository; secret scanning and push protection
  are on
- Vulnerabilities: see [SECURITY.md](SECURITY.md)

## Architecture decisions

| ADR                                                                    | Decision                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [0001](docs/adr/0001-record-architecture-decisions.md)                 | Record architecture decisions                                    |
| [0002](docs/adr/0002-clean-architecture.md)                            | Clean Architecture with ports and adapters                       |
| [0003](docs/adr/0003-openapi-from-zod.md)                              | Generate the OpenAPI 3.1 contract from Zod                       |
| [0004](docs/adr/0004-least-privilege-database-roles.md)                | Least-privilege database roles                                   |
| [0005](docs/adr/0005-per-event-validation.md)                          | Validate each event of a batch on its own                        |
| [0006](docs/adr/0006-lambda-behind-cloudfront.md)                      | Run on Lambda behind CloudFront, with an edge secret             |
| [0007](docs/adr/0007-email-code-sign-in-with-opaque-sessions.md)       | Sign admins in with an emailed code and an opaque session cookie |
| [0008](docs/adr/0008-dashboard-queries-on-raw-events.md)               | Answer dashboard queries from the raw events, without rollups    |
| [0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md)       | Erase a person together with the visits they identified in       |
| [0010](docs/adr/0010-compare-an-unfinished-day-up-to-the-same-time.md) | Compare an unfinished day up to the same time of day             |

## Roadmap

- [x] Service skeleton, quality gates, OpenAPI export
- [x] Database: Drizzle, migrations, least-privilege roles, local Postgres
- [x] Ingestion: domain rules, `POST /v1/batch`, project and key scripts
- [x] Deployment code: Lambda handlers, image, Terraform, deploy script, runbook
- [x] First apply to AWS
- [x] Dashboard sign-in: emailed code, opaque sessions, `admin:grant`
- [x] Dashboard queries: overview, devices, acquisition, features, requests, funnel, timeline
- [x] Visits list: filtered by pages, events, channel, device and identity
- [x] Property breakdown of a named event
- [x] Erasure and export of a person's events
- [x] Retention: a daily job deletes events older than 13 months
- [x] API reference on GitHub Pages
- [x] Database size report and alarm (in Terraform, applied with the stack)
- [x] Load test script, run against the local stack
- [x] Load test through CloudFront

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Released
under the [MIT License](LICENSE).
