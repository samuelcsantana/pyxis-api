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

</div>

> **Status:** early development. The service skeleton, its quality gates and the OpenAPI export are
> in place; event ingestion is the next milestone (see [Roadmap](#roadmap)).

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

Planned for v1 (see [Roadmap](#roadmap)):

- `POST /v1/batch`: batched ingestion with a public project key, a per-project origin allowlist,
  rate limits, deduplication and a server-side barrier that drops anything that looks like an
  email, a phone number or a tax id
- Device, browser and country derived on the server; the user agent and the address are never
  stored
- Dashboard sign-in by email code, with sessions checked on every request
- Queries for the overview, funnels, features, request errors, devices, acquisition and timelines
- `DELETE /v1/subjects/{userId}`: erases a person's events, including the anonymous part of the
  visit they signed up in
- Automatic deletion of events older than 13 months

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

To run the API from source instead, keep only the database in Docker:

```bash
docker compose up -d db
npm ci && npm run build
MIGRATION_DATABASE_URL=postgres://pyxis:pyxis@localhost:5446/pyxis APP_DB_ROLE=pyxis_app npm run db:migrate
DATABASE_URL=postgres://pyxis_app:pyxis_app@localhost:5446/pyxis npm start
```

Configuration is validated at boot ([`src/config/env.schema.ts`](src/config/env.schema.ts)):

| Variable                 | Default       | Meaning                                                        |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `PORT`                   | `3040`        | HTTP port                                                      |
| `NODE_ENV`               | `development` | `development`, `production` or `test`                          |
| `SWAGGER_ENABLED`        | unset         | `true`/`false`; unset means on everywhere except production    |
| `DATABASE_URL`           | required      | The API's connection, as the application role                  |
| `MIGRATION_DATABASE_URL` | unset         | The owner's connection, used only by `npm run db:migrate`      |
| `APP_DB_ROLE`            | unset         | The role granted row access after each migration (`pyxis_app`) |

In production every database URL ends in `sslmode=verify-full`.

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

| Excluded                    | Reason                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `src/main.ts`               | Process entry point: wires the app and listens; the e2e suite boots it |
| `src/export-openapi.ts`     | Command-line entry point; CI runs it and checks its output             |
| `src/migrate.ts`            | Command-line entry point; the compose stack and CI's image job run it  |
| `src/**/*.module.ts`        | Nest module declarations: wiring without logic                         |
| `eslint-rules/`, `scripts/` | Tooling outside `src/`, tested on Node's test runner instead           |

## Project structure

```text
src/
├── config/            environment validation (Zod)
├── infra/database/    Drizzle and postgres-js, the migration step, the role check
├── infra/http/        Fastify setup, security headers, request id, health, OpenAPI
├── shared/            pure utilities
├── main.ts            HTTP entry point
├── migrate.ts         migration entry point
└── export-openapi.ts  writes openapi/openapi.json
test/integration/      adapters against a real Postgres
test/e2e/              the application over HTTP
docker-compose.yml     Postgres 18, the migration step and the API
openapi/openapi.json   the published contract, regenerated by npm run openapi:export
eslint-rules/          the local no-comments ESLint rule
scripts/               the comment check for files ESLint does not read
docs/adr/              architecture decision records
```

`domain/`, `usecases/` and `test-utils/` appear with the first business rules.

## Contract

`openapi/openapi.json` is the source of truth for the other two repositories: the SDK and the
dashboard copy it from `main` and test against it. CI regenerates it on every pull request and
fails when the committed file differs from the code ([ADR 0003](docs/adr/0003-openapi-from-zod.md)).

## Privacy and security

- No cookies on ingestion, no personal data in events, IP address and user agent never stored
- Strict response headers: a CSP that loads nothing, no framing, nosniff, no referrer, HSTS and
  `no-store` by default
- `X-Forwarded-For` is never trusted for the client address
- Secrets live in AWS Parameter Store, never in the repository; secret scanning and push protection
  are on
- Vulnerabilities: see [SECURITY.md](SECURITY.md)

## Architecture decisions

| ADR                                                     | Decision                                   |
| ------------------------------------------------------- | ------------------------------------------ |
| [0001](docs/adr/0001-record-architecture-decisions.md)  | Record architecture decisions              |
| [0002](docs/adr/0002-clean-architecture.md)             | Clean Architecture with ports and adapters |
| [0003](docs/adr/0003-openapi-from-zod.md)               | Generate the OpenAPI 3.1 contract from Zod |
| [0004](docs/adr/0004-least-privilege-database-roles.md) | Least-privilege database roles             |

## Roadmap

- [x] Service skeleton, quality gates, OpenAPI export
- [x] Database: Drizzle, migrations, least-privilege roles, local Postgres
- [ ] Ingestion: domain rules, `POST /v1/batch`, project and key scripts
- [ ] Deployment: Lambda, CloudFront and Terraform
- [ ] Dashboard sign-in and queries
- [ ] Erasure and retention
- [ ] Load test, database size alarm, API reference on GitHub Pages

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Released
under the [MIT License](LICENSE).
