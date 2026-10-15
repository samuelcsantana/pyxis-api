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

> **Status:** in production since 2026-10-06 at `api.pyxis-analytics.dev` (AWS Lambda behind
> CloudFront, sa-east-1): ingestion, dashboard sign-in and queries, erasure, retention and the
> weekly digest. `main` is deployed by the deploy script on request (see [Roadmap](#roadmap)).

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

Read more: [why Pyxis was built and what it never stores][post], the introduction post on the
author's blog, also in [Portuguese][post-pt] and [Spanish][post-es].

[post]: https://www.samuelsantana.dev/en/blog/pyxis-analytics-without-cookies-ip-or-personal-data
[post-pt]: https://www.samuelsantana.dev/blog/pyxis-analytics-sem-cookie-sem-ip-sem-dado-pessoal
[post-es]: https://www.samuelsantana.dev/es/blog/pyxis-analytics-sin-cookies-sin-ip-sin-datos-personales

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
- Device, browser, operating system, channel, country and region derived on the server; the user
  agent and the address are read, classified and discarded, and the city is never read
  ([ADR 0014](docs/adr/0014-store-the-region-never-the-city.md))
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
  logo (`/email/pyxis-logo.png` on `DASHBOARD_ORIGIN`, which every link in the e-mails points
  at too), and its words live in a typed
  message table in English, Brazilian Portuguese and Spanish. The dashboard sends its own
  language as an optional `locale` in `POST /v1/auth/request-code`
  (`{"email":…,"locale":"pt-BR"}`), matched on the language (`pt-PT` gets pt-BR, `es-MX` gets
  Spanish); no `locale`, or one the API has no email for, gets English, so sign-in never fails
  over a language
- Dashboard queries over any range of up to 400 days in the project's time zone:
  `GET /v1/projects/{projectId}/overview` (visits, identified users, conversions and failed
  writes against the previous period, daily activity of both periods, top pages and events; a
  range that ends today is compared with the previous period up to the same time of day, and the
  answer says which time that was:
  [ADR 0010](docs/adr/0010-compare-an-unfinished-day-up-to-the-same-time.md)),
  `/devices` (device type, browser, system and country, top five and "other", plus the top ten
  regions, "other" and the visits without a region) and
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
  to the next and through the whole funnel), `/funnel/segments?steps=&by=device|channel` (the
  same funnel per device type or channel of the visit, visit mode only, adding up to it),
  `/funnel/subjects?step=&outcome=reached|dropped`
  (the visits, or identified people, who reached one step or reached the one before and never
  it, newest first with a cursor) and
  `/timeline?user_id=|session_id=` (the visits of a person, the anonymous one they identified in
  included, or of one visit, newest first, 20 per page, with every event and the first id the
  visit was identified with, so a visit opened by its id leads to its person) and
  `/visits` (the visits of the range, newest first, 50 per page with a cursor, each with its
  entry page, page views, first named events, failed requests and the source and campaign it
  came from, plus the total of matching visits; filtered by up to three pages it viewed, a star
  matching any characters, a named event with an optional property value, channel, device,
  country, region, source, campaign, whether it was identified, a request route
  (`POST /orders/:id`) and
  whether a request, or a request to that route, failed; a visit is one browser tab, and nothing
  links two of them) and
  `/settings` (read-only: time zone, conversion event, allowed origins, first and latest event,
  how many months events are kept, the live public keys, and when each live secret key was
  created; a secret key never leaves the API, not even as its hash) and
  `/time-of-day` (for each weekday, Monday first, and each local hour, the visits whose first page
  view happened then; the grid adds up to the visits of the range) and
  `/engagement` (the top entry and exit pages, the visits that viewed a single page, and the visit
  length from the first to the last event: the median and seven buckets). A project
  the admin may not read answers the same 404 as one that does not exist
  ([ADR 0008](docs/adr/0008-dashboard-queries-on-raw-events.md))

- `GET /v1/projects/{projectId}/icon` answers the icon of the project's site, so the dashboard
  can show it beside the project's name: the touch icon or the largest icon the home page of the
  first allowed origin declares, else `/favicon.ico`, PNG, ICO, JPEG, WEBP or GIF only, up to
  100 KB, cached privately for a day. `GET /v1/me` carries its `icon_version`, a hash of the
  bytes that changes only when the icon does; a project whose site shows none answers 404 and
  `icon_version: null`, and the dashboard keeps the initials

- `GET` and `PUT /v1/projects/{projectId}/email-preferences` (`{"weekly_digest":true}`): the
  signed-in admin chooses, for one project and for themselves only, whether to receive the
  weekly digest, on by default. Saving changes an existing access and never grants one. The
  dashboard's server sends the change with the admin's session cookie; another site cannot,
  because a `PUT` is never a simple cross-origin request and the cookie is `SameSite=Lax`. The
  admin's e-mails are written in the language of their last sign-in: it is kept on the sign-in
  code and copied to the admin only when that code is verified, so knowing an admin's address
  is not enough to change it

- Read-only access tokens for agents and scripts: the signed-in admin creates up to 10 named
  tokens (`POST /v1/me/tokens`, `{"name":"Claude Code","expires_in_days":90}`, 30, 90 or 365
  days), sees them with their last use (`GET /v1/me/tokens`) and revokes them
  (`DELETE /v1/me/tokens/{tokenId}`). A token, sent as `Authorization: Bearer pyxis_at_…`, reads
  `GET /v1/me` and every `GET /v1/projects/{projectId}/…` report of the projects its admin is
  granted, and nothing else ([ADR 0015](docs/adr/0015-read-only-access-tokens-for-agents.md))

- Accounts for the hosted plan: an account is who pays, with one owner and the projects it holds
  (3 at most, counted under a lock so two requests cannot both take the last place). A project
  without an account is the operator's own, as every project was before, with no plan and no
  quota ([ADR 0016](docs/adr/0016-accounts-own-projects.md))
- A monthly quota for those accounts: the daily job counts each account's events in the current
  calendar month (UTC) and keeps the figure; an account past 150% of its plan (100,000 events) is
  paused until the month turns, and its batches are answered `403 quota_exceeded`, readable by
  the site's origin so the tracker drops them instead of retrying. Free (`comped`) accounts and the
  operator's projects are never paused
  ([ADR 0017](docs/adr/0017-monthly-quota-measured-daily.md)). The owner is told by e-mail once
  per level and month, in their language: at 80%, at 100% (nothing is cut off) and when the pause
  starts; a failed e-mail is tried again the next day, and the optional `SUPPORT_EMAIL` is named in
  it and receives the replies

- Billing through Stripe: `POST /v1/billing/stripe/webhook` takes Stripe's signed events (raw body,
  up to 512 KB), applies each one once (`billing_events`), always re-reads the subscription before
  changing the account (trialing, active, past due, ending with the date access ends, ended), and
  answers 503 when Stripe cannot be read so Stripe sends the event again. `account:link` ties a
  subscription paid through a payment link to an account
  ([ADR 0018](docs/adr/0018-billing-follows-stripe-through-its-webhook.md))
- Sign-up, closed until `SIGNUP_OPEN=true`, a `TERMS_VERSION` and a `TERMS_URL` are set (otherwise
  `404`):
  `GET /v1/auth/sign-up` says whether it is open and which terms to show, with their address;
  `POST /v1/auth/sign-up/code` e-mails a code (202 for any address, the sign-in limits plus 50
  sign-up codes a day in all); `POST /v1/auth/sign-up/verify` takes the code and the terms version
  accepted (`409 terms_outdated` if it is not the current one), records the acceptance and answers
  a session and an `incomplete` account. `GET /v1/me/accounts` lists the admin's accounts with
  their billing state and the month measured; `POST /v1/accounts/{accountId}/checkout` opens
  Stripe Checkout (with the 14-day trial the first time) and `.../portal` the billing portal, for
  the owner only ([ADR 0019](docs/adr/0019-sign-up-behind-a-switch-and-the-terms-version.md))
- Projects managed by the owner of their account, from the dashboard (origin and session
  required): `POST /v1/accounts/{accountId}/projects` (the plan's three), `PATCH
/v1/projects/{projectId}` (name, up to five origins, time zone, conversion event),
  `POST /v1/projects/{projectId}/delete` (the name typed again), `POST
/v1/projects/{projectId}/keys` (a secret key is shown once; five live keys of each kind) and
  `DELETE /v1/projects/{projectId}/keys/{keyId}` (only a key of that project; the last public key
  stays). Anyone else gets 404; an account without a running subscription gets
  `409 subscription_required`. The project settings say the admin's `role`
  ([ADR 0020](docs/adr/0020-owners-manage-their-projects-from-the-dashboard.md))
- People of a project: `GET /v1/projects/{projectId}/people` for anyone who reads it; the owner
  adds an address (`POST`, with an invitation e-mail in the language of the page) and takes
  someone off (`DELETE .../people/{adminUserId}`). The plan's three people are counted across the
  account's projects, the owner included, under the account lock; the owner always stays
  ([ADR 0021](docs/adr/0021-people-are-counted-across-the-account.md))
- The end of a hosted account, run by the daily job: subscriptions reconciled with Stripe, keys
  revoked when access ends, the owner told and reminded by e-mail, everything deleted thirty days
  later (events in batches), and sign-ups that never subscribed removed after seven days; each step
  once, recorded on the account ([ADR 0022](docs/adr/0022-an-account-ends-in-steps.md))
- The welcome e-mail, sent by the webhook as soon as an account gains access (the trial end, the
  first step, the version and address of the terms accepted), with the daily job sending it to any
  signed-up account the webhook could not welcome
  ([ADR 0023](docs/adr/0023-the-welcome-follows-the-subscription.md))
- Exports for the owner, in any account state: `POST /v1/projects/{projectId}/exports` (202; one
  waiting, three a day) hands the export to the jobs function, which writes the events as a gzipped
  CSV to a private bucket that deletes it after a week and e-mails the owner; `GET
.../exports/{exportId}` shows it with a download link signed for five minutes
  ([ADR 0024](docs/adr/0024-exports-are-files-with-short-links.md))

- `DELETE /v1/subjects/{userId}` erases a person's events, including the anonymous part of the
  visit they identified in, and `GET /v1/subjects/{userId}/events` exports them, both from the
  site's backend with a secret project key
  ([ADR 0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md))

- A daily job deletes events older than 13 months, then expired dashboard sessions and sign-in
  codes, then measures each account's month (the quota); each step logs its count, and a failed
  step fails the run so the scheduler retries.
  Last, it refreshes the project icons, best effort: an icon found replaces the stored one, a
  site that answers without one loses it, and a site that cannot be reached keeps it

- A weekly digest by e-mail, on Mondays at 11:00 UTC: each admin gets, per project, the week that
  closed on Sunday in the project's time zone against the week before (visits, identified users,
  converting visits, failed writes, visits per day, top pages and events, the write routes that
  failed), in the language of their last sign-in, with a link to the same week in the dashboard.
  The inbox preview carries the identified users, converting visits and failed writes, and the
  time zone is named in the reader's language ("Horário Padrão de Brasília"). A week without
  visits says when the last event arrived, in the preview too. The numbers come from the
  dashboard's own queries; each digest is sent once per admin, project and week, and one failed
  e-mail does not stop the others ([ADR 0011](docs/adr/0011-weekly-digest-from-the-jobs-function.md))

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
    Scheduler["EventBridge Scheduler"] --> Jobs["Lambda jobs<br>retention · icons · weekly digest"]
  end
  DB[("Postgres<br>(Neon)")]
  Mail["Resend or Amazon SES"]
  SDK -- "POST /v1/batch · public key" --> CF
  Dashboard -- "queries · session cookie" --> CF
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

| Command                                                                                                                                                         | What it does                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run -s project:create -- --name <name> --origin <origin>… [--timezone <IANA zone>] [--conversion-event <event>] [--account <id>]`                          | Creates a project and its first public key, printed for the site to embed; with `--account`, inside that account (readable by its owner, 3 at most)                     |
| `npm run -s project:update -- --project <id> [--name <name>] [--origin <origin>…] [--timezone <zone>] [--conversion-event <event> \| --clear-conversion-event]` | Replaces the settings it is given; `--origin` replaces the whole list                                                                                                   |
| `npm run -s project:delete -- --project <id> --confirm-name <name>`                                                                                             | Deletes the project with its events, keys, grants, icon and digest records in one transaction, only when the name matches exactly; prints how many events and keys went |
| `npm run -s key:create -- --project <id> --kind <public\|secret>`                                                                                               | Prints the new key alone on stdout; a secret key is shown only then and stored as a hash                                                                                |
| `npm run -s key:revoke -- --key-id <id>`                                                                                                                        | Revokes a key; running instances may accept it for up to 60 seconds from their cache                                                                                    |
| `npm run -s admin:grant -- --email <email> --project <id>`                                                                                                      | Creates the admin when needed and lets them sign in to the dashboard and read the project                                                                               |
| `npm run -s admin:revoke -- --email <email> --project <id>`                                                                                                     | Takes the person off that project; the owner of the project's account always stays                                                                                      |
| `npm run -s usage:report -- [--month YYYY-MM]`                                                                                                                  | For every project, the events and distinct visits received in a calendar month in UTC (the current one by default), as tab-separated lines, busiest first               |
| `npm run -s account:create -- --owner-email <email>`                                                                                                            | Opens a free (comped) account for the owner, creating the admin when needed, and prints its id                                                                          |
| `npm run -s account:show -- --account <id>`                                                                                                                     | Prints the account's status and owner, its projects and people against the plan limits, the month's events as last measured, any pause, and one line per project        |
| `npm run -s account:link -- --account <id> --subscription <sub_…>`                                                                                              | Ties a subscription paid outside sign-up (a payment link) to the account and copies its state; needs `STRIPE_SECRET_KEY`                                                |

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

| Variable                 | Default                                                       | Meaning                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                   | `3040`                                                        | HTTP port                                                                                                                                                                                                                                      |
| `NODE_ENV`               | `development`                                                 | `development`, `production` or `test`                                                                                                                                                                                                          |
| `SWAGGER_ENABLED`        | unset                                                         | `true`/`false`; unset means on everywhere except production                                                                                                                                                                                    |
| `DATABASE_URL`           | required                                                      | The API's connection, as the application role                                                                                                                                                                                                  |
| `MIGRATION_DATABASE_URL` | unset                                                         | The owner's connection, used only by `npm run db:migrate`                                                                                                                                                                                      |
| `APP_DB_ROLE`            | unset                                                         | The role granted row access after each migration (`pyxis_app`)                                                                                                                                                                                 |
| `CLIENT_IP_HEADER`       | unset                                                         | A header the edge overwrites with the client address, for the per-address limit (`cloudfront-viewer-address` behind CloudFront); unset means the socket address                                                                                |
| `DASHBOARD_ORIGIN`       | unset; required in production                                 | The only origin allowed to call the sign-in routes from a browser (unset refuses them all), and the base of every link and of the logo in the e-mails; required wherever `RESEND_API_KEY` is set                                               |
| `MAIL_PROVIDER`          | `resend`                                                      | Which service sends the e-mails: `resend` or `ses` (Amazon SES in the function's region, through its role; see the runbook)                                                                                                                    |
| `RESEND_API_KEY`         | unset; required in production unless `MAIL_PROVIDER` is `ses` | Sends the e-mails through Resend; without it, outside production, codes are logged instead                                                                                                                                                     |
| `MAIL_FROM`              | `Pyxis <noreply@pyxis-analytics.dev>`                         | Sender of every e-mail; its domain must be verified in Resend or SES                                                                                                                                                                           |
| `SUPPORT_EMAIL`          | unset                                                         | Named in the account e-mails (quota notices), which send replies to it                                                                                                                                                                         |
| `STRIPE_SECRET_KEY`      | unset                                                         | Stripe secret or restricted key of the hosted plan's billing (Checkout with the prices whose lookup keys are `pyxis_monthly_brl` and `pyxis_yearly_brl`, the customer portal); unset, or anything that is not a Stripe key, leaves billing off |
| `STRIPE_WEBHOOK_SECRET`  | unset                                                         | Signing secret of the Stripe webhook endpoint; without it no billing event is accepted                                                                                                                                                         |
| `SIGNUP_OPEN`            | `false`                                                       | `true` lets anyone create an account and subscribe, once `TERMS_VERSION` and `TERMS_URL` are set too                                                                                                                                           |
| `TERMS_VERSION`          | unset                                                         | The version of the published terms a new owner accepts (at most 32 characters); sign-up stays closed without it                                                                                                                                |
| `TERMS_URL`              | unset                                                         | Where the published terms are (http or https); sign-up stays closed without it, and the welcome e-mail links to it                                                                                                                             |
| `EXPORT_BUCKET`          | unset                                                         | The bucket project exports are written to; without it exports answer 503                                                                                                                                                                       |
| `JOBS_FUNCTION_NAME`     | unset                                                         | The jobs function an export is handed to; without it exports wait for the daily job                                                                                                                                                            |

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
├── lambda/            the Lambda handlers (HTTP behind CloudFront, migrations, scheduled jobs)
├── usecases/          one class per operation (ingestion, projects, keys, sign-in, queries)
├── infra/database/    Drizzle schema, postgres-js, the migration step, the role check
├── infra/repositories/ Drizzle adapters and the 60-second project key cache
├── infra/queries/     the dashboard queries in SQL and the definitions they share
├── infra/rate-limit/  the per-project limiter
├── infra/mail/        the e-mails (words per language, HTML, plain text) sent through Resend or
│                      Amazon SES, or the log outside production
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
CloudFront adds; the function's own URL answers 403 without it. CloudWatch alarms e-mail the
operator when requests end in unexpected errors, when the function fails, times out or is
throttled, when the database grows, and when sign-in codes are being guessed. Provisioning,
deploys, checks, alarms and rollbacks are in the [runbook](docs/RUNBOOK.md). Merging a pull
request never deploys.

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
  hints, then the user agent is discarded; the country and the region (`BR-SP`) come from
  CloudFront, never from the IP, and the city is never read
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
- The weekly digest carries aggregates, paths, event names and routes only, never a user id or a
  link to a visit, and its logs name projects and admins by id, never by address
- Dashboard sign-in never says whether an email belongs to an admin (always 202, empty body).
  Codes and session tokens are stored only as SHA-256 hashes; a code allows five guesses and one
  use, and expires in 10 minutes. Sessions end after 7 days, after 24 hours idle, at sign-out,
  one by one from the sessions list (`GET /v1/me/sessions`, `DELETE /v1/me/sessions/:id`), or
  all at once when the admin signs out everywhere (`POST /v1/auth/logout-all`). A session keeps
  only the browser, system and device type classified at sign-in (chrome, windows, desktop…), so
  the list can tell devices apart; the user agent and the address are never stored.
  The API sets no cookie: the token is answered once, and the dashboard keeps it in a cookie of
  its own host and forwards it from its server (ADR 0012)
- The sign-in routes accept only the dashboard's `Origin`, grant CORS to it without credentials,
  and allow five requests per address every fifteen minutes on each route. Two CloudWatch alarms
  e-mail the operator when codes are being guessed (20 rejected codes in 15 minutes) or an
  admin's inbox flooded (5 refused code requests in an hour), counted from log lines that carry
  neither the e-mail nor the address
- Erasure deletes the person's events and every visit they identified in, in one statement, and
  logs only how many rows went, never the user id. Secret keys are looked up by hash on every call
  (no cache, so revoking one takes effect at once) and limited to 60 calls a minute each; the
  same 60 a minute applies per client address and is counted before the key is checked, so an
  unknown key cannot be tried without limit
- An access token is answered once and stored only as a SHA-256 hash, looked up on every request
  with no cache, so a revoked token stops at once. It reads only: the sessions and tokens routes,
  signing out everywhere, the e-mail preferences and the icon refuse it with 401, signing out
  ignores it, and a request that carries one is judged by it alone, even with a session cookie. Each token allows 60 requests a minute
  and lasts at most a year; creating and revoking them needs a dashboard session and the
  dashboard's `Origin`, and the logs name tokens and admins by id only
- Fetching a site's icon is the API's only request to an address it does not choose: https only,
  the host resolved before every request (redirects too, at most three, followed by hand) and
  refused when any address is loopback, private, link-local, carrier-grade NAT, unique-local,
  multicast or reserved, five seconds per request, the home page read up to 512 KB and the icon
  up to 100 KB, and the image accepted only when its first bytes are a PNG, ICO, JPEG, WEBP or
  GIF, never SVG. The icon is served with the same strict headers as every response
- Secrets live in AWS Parameter Store, never in the repository; secret scanning and push protection
  are on
- Vulnerabilities: see [SECURITY.md](SECURITY.md)

## Architecture decisions

| ADR                                                                      | Decision                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [0001](docs/adr/0001-record-architecture-decisions.md)                   | Record architecture decisions                                              |
| [0002](docs/adr/0002-clean-architecture.md)                              | Clean Architecture with ports and adapters                                 |
| [0003](docs/adr/0003-openapi-from-zod.md)                                | Generate the OpenAPI 3.1 contract from Zod                                 |
| [0004](docs/adr/0004-least-privilege-database-roles.md)                  | Least-privilege database roles                                             |
| [0005](docs/adr/0005-per-event-validation.md)                            | Validate each event of a batch on its own                                  |
| [0006](docs/adr/0006-lambda-behind-cloudfront.md)                        | Run on Lambda behind CloudFront, with an edge secret                       |
| [0007](docs/adr/0007-email-code-sign-in-with-opaque-sessions.md)         | Sign admins in with an emailed code and an opaque session cookie           |
| [0008](docs/adr/0008-dashboard-queries-on-raw-events.md)                 | Answer dashboard queries from the raw events, without rollups              |
| [0009](docs/adr/0009-erase-a-person-with-their-linked-visits.md)         | Erase a person together with the visits they identified in                 |
| [0010](docs/adr/0010-compare-an-unfinished-day-up-to-the-same-time.md)   | Compare an unfinished day up to the same time of day                       |
| [0011](docs/adr/0011-weekly-digest-from-the-jobs-function.md)            | Send a weekly digest by e-mail from the jobs function                      |
| [0012](docs/adr/0012-session-cookie-set-by-the-dashboard.md)             | Let the dashboard keep the session in a cookie of its own host             |
| [0013](docs/adr/0013-project-icons-fetched-from-the-site.md)             | Fetch each project's icon from its site, and keep a copy                   |
| [0014](docs/adr/0014-store-the-region-never-the-city.md)                 | Store the viewer's region, never the city                                  |
| [0015](docs/adr/0015-read-only-access-tokens-for-agents.md)              | Give agents read-only access tokens, scoped to their admin                 |
| [0016](docs/adr/0016-accounts-own-projects.md)                           | Accounts own projects; a project without one is the operator's             |
| [0017](docs/adr/0017-monthly-quota-measured-daily.md)                    | Measure each account's month daily; pause ingestion at 150%                |
| [0018](docs/adr/0018-billing-follows-stripe-through-its-webhook.md)      | Billing follows Stripe through its webhook, re-reading the subscription    |
| [0019](docs/adr/0019-sign-up-behind-a-switch-and-the-terms-version.md)   | Sign-up behind a switch, tied to the version of the terms accepted         |
| [0020](docs/adr/0020-owners-manage-their-projects-from-the-dashboard.md) | Owners manage their projects; the operator's stay in the command line      |
| [0021](docs/adr/0021-people-are-counted-across-the-account.md)           | People are added per project and counted across the account                |
| [0022](docs/adr/0022-an-account-ends-in-steps.md)                        | An account ends in steps, each done once by the daily job                  |
| [0023](docs/adr/0023-the-welcome-follows-the-subscription.md)            | The welcome follows the subscription, with the daily job as a fallback     |
| [0024](docs/adr/0024-exports-are-files-with-short-links.md)              | Exports are files that live a week, reached through links signed on demand |

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
- [x] E-mail preferences: the weekly digest switch and the admin's language
- [x] Weekly digest e-mail on Mondays
- [x] Sign-in abuse alarms: rejected codes and refused code requests, read from the logs
- [x] Read-only access tokens for agents (an MCP server that uses them comes next)
- [x] Accounts that own projects, with the hosted plan's project limit
- [x] Monthly quota per account, measured daily, ingestion paused at 150%
- [x] Billing through Stripe: Checkout, portal and the webhook that keeps each account's status
- [x] Sign-up behind a switch, with the terms version accepted and Checkout for the owner
- [x] Projects and keys managed by the owner of their account
- [x] People added and removed by the owner, with an invitation e-mail
- [x] The end of an account: reconciliation, revoked keys, notices and deletion after thirty days
- [x] The welcome e-mail with the terms accepted
- [x] Exports of a project, by e-mail, for a week
- [ ] Hosted plan: account deletion requested by the owner

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Released
under the [MIT License](LICENSE).
