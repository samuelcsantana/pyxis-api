# 6. Run on Lambda behind CloudFront, with an edge secret

Date: 2026-10-05

## Status

Accepted

## Context

The API serves bursts of small batches from browsers and a dashboard used by a handful of people.
An always-on server would sit idle most of the day; the database is Neon in São Paulo. A Lambda
Function URL is cheap and needs no API Gateway, but it cannot carry a custom domain and it is
public: anyone who learns its address can call it directly, bypassing whatever runs in front.

## Decision

- The app runs as a container image on Lambda in sa-east-1, next to the database, with a Function
  URL as its only entry.
- CloudFront serves the API's domain in front of that URL, caches nothing, and forwards every
  viewer header except Host, so `CloudFront-Viewer-Address` and `CloudFront-Viewer-Country` reach
  the app.
- CloudFront adds a secret header to every origin request; the handler answers 403 to any request
  without it, before building the app. That is what makes trusting `CloudFront-Viewer-Address`
  for the per-address rate limit sound.
- Configuration and secrets live in Parameter Store and are loaded at cold start; the app module
  is imported only afterwards, because its configuration is validated when it is imported.
- Migrations run in a separate function with a separate role, the only one allowed to read the
  owner's connection; the deploy script runs them before updating the HTTP function.
- Reserved concurrency bounds the number of execution environments, and with it the global worst
  case of the in-memory rate limits.

## Consequences

- No server to patch or pay for when idle; cold starts cost a dashboard request a second or two.
- The Function URL stays reachable but useless without the secret.
- Rate limits are per execution environment, not global; the concurrency cap keeps their sum
  bounded.
- The repository stays account-agnostic: the Terraform backend is partial and the role ARN a
  variable, both filled in by the operator outside git.
