# Contributing to pyxis-api

Thanks for your interest. This document explains how the repository is organized and what a pull
request needs before it can be merged.

## Prerequisites

- Node.js 24 (`.nvmrc`) and npm 11
- Docker, for the local database and the image (from the database task onward)
- Git Bash or another POSIX shell on Windows; with Git Bash, set `MSYS_NO_PATHCONV=1` before AWS
  CLI commands that take a path

## Setup

```bash
npm ci
npm run build
npm start          # http://localhost:3040/health
```

`npm ci` also installs the Git hooks (Husky).

## Scripts

| Script                                | What it does                                                         |
| ------------------------------------- | -------------------------------------------------------------------- |
| `npm run lint`                        | ESLint, then the comment check for YAML, shell, Docker and SQL files |
| `npm run format` / `format:check`     | Prettier                                                             |
| `npm run typecheck`                   | TypeScript in strict mode, for the app and for the scripts           |
| `npm test` / `npm run test:cov`       | Unit tests; `test:cov` enforces 100% coverage                        |
| `npm run test:e2e`                    | The application over HTTP                                            |
| `npm run test:tooling`                | Tests of the lint rule and the comment check                         |
| `npm run openapi:export`              | Regenerates `openapi/openapi.json` from the code                     |
| `npm run build:watch` + `start:watch` | Recompile and restart on change, in two terminals                    |

## Workflow

- `main` is the only long-lived branch and is protected. Cut a branch from an up-to-date `main`,
  named `feat/…`, `fix/…`, `refactor/…`, `perf/…`, `test/…`, `docs/…`, `ci/…`, `build/…` or
  `chore/…`, and open a pull request into `main`.
- One change per pull request. A contract change ships here first, backward compatible, before the
  SDK and the dashboard follow.
- Pull requests are merged with **Rebase and merge**, so every commit lands on `main` as written.
  Keep commits atomic: each one builds and passes the tests on its own.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope):
summary`, lower case, body lines of at most 100 characters). A hook and a CI job check them.

## Code rules

- **No comments in code**, in any file: TypeScript, JavaScript, YAML, shell, Dockerfiles, SQL,
  Terraform and configuration. Names, small functions, types and tests carry the meaning; the
  _why_ goes in the commit body, the pull request, an [ADR](docs/adr/) or the README. An ESLint rule
  and a script enforce it. The only exceptions are a shebang line and generated files.
- Never silence a check: no `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or coverage ignore
  comments. Fix the cause.
- Dependencies point inward: `infra` → `usecases` → `domain`. Every external input or output is a
  port in `domain`, an adapter in `infra` and an in-memory fake in `test-utils`.
- New dependencies must be MIT, Apache-2.0, BSD or ISC licensed, and justified in the pull request.

## Tests

- Coverage stays at **100%** of statements, branches, functions and lines. Every branch a change
  introduces has a test for each side.
- A bug fix starts with a failing test that reproduces it.
- Tests are deterministic: fake the clock, no network, no sleeps.
- Test data is invented. Never use real user data.

## Before you open a pull request

- [ ] `npm run lint`, `npm run typecheck`, `npm run test:cov`, `npm run test:e2e` pass
- [ ] `npm run openapi:export` leaves `openapi/openapi.json` unchanged, or the change is intended
- [ ] The behavior was exercised by running it, and the pull request says how
- [ ] README and ADRs are updated when the change touches them

## Security

Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md), never in a public
issue.
