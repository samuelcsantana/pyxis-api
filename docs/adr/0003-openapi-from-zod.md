# 3. Generate the OpenAPI 3.1 contract from Zod

Date: 2026-10-05

## Status

Accepted

## Context

Three repositories share one HTTP contract: this API owns it, the browser SDK builds requests
against it and the dashboard reads its responses. A common NestJS setup describes each payload
twice, once as a validation schema and once as a Swagger DTO class, and the two drift apart.

NestJS 12 and `@nestjs/swagger` 12 accept [Standard Schema](https://standardschema.dev) objects,
which Zod 4 implements, both for validation and for documentation.

## Decision

- Every request and response shape is a Zod schema, used directly by the route for validation and
  for the OpenAPI document. There are no Swagger DTO classes.
- The document is OpenAPI 3.1. A custom converter asks Zod for JSON Schema 2020-12, which is what
  OpenAPI 3.1 schemas are, so consumers can validate against them with any JSON Schema tool.
- `npm run openapi:export` writes `openapi/openapi.json` from the compiled application booted in
  preview mode, with keys sorted for stable diffs. The file is committed.
- CI regenerates the file on every pull request and fails when it differs from the committed one.
- The SDK and the dashboard copy the file from `main` and run contract tests against it. A
  breaking change gets a new path version (`/v2`) instead of changing `/v1`.

## Consequences

- One definition per shape; validation and documentation cannot disagree.
- A contract change shows up as a reviewable diff of `openapi/openapi.json` in the same pull
  request.
- `@nestjs/swagger` normalizes some 2020-12 keywords for OpenAPI 3.0 compatibility (`const`
  becomes a one-value `enum`), which is still valid JSON Schema 2020-12.
