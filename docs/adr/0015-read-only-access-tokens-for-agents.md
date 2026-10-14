# 15. Read-only access tokens for agents

Date: 2026-10-14

## Status

Accepted. Builds on [ADR 0007](0007-email-code-sign-in-with-opaque-sessions.md) (opaque sessions
stored as hashes) and [ADR 0012](0012-session-cookie-set-by-the-dashboard.md) (the session cookie
lives on the dashboard's host).

## Context

The dashboard's numbers could only be read through a dashboard session: a cookie on the
dashboard's host, forwarded by its server. Tools that run outside a browser (an MCP server in a
coding agent, a script, a notebook) had no way in. Three options were weighed: reuse the session
token (it can sign out, end other sessions and change preferences, and it dies after 24 hours
idle), issue keys per project (a new grant to manage beside the admin's own access), or give each
admin tokens that read exactly what their session reads, and nothing else.

## Decision

- **Whose:** a token belongs to an admin and reads every project that admin is granted, checked
  on each request like a session, so taking a grant away takes it from the token too. It carries
  the prefix `pyxis_at_` and 32 random characters, so leaked ones are easy to recognize.
- **What it can do:** only the dashboard's `GET` queries (`GET /v1/me` and the
  `/v1/projects/{projectId}/…` reports) accept `Authorization: Bearer pyxis_at_…`. Every write,
  sign-out, the sessions and tokens lists, the e-mail preferences and the
  project icon stay session-only. A request with an `Authorization` header is judged by the token
  alone, even when a session cookie comes with it.
- **Lifetime and storage:** 30, 90 (the default) or 365 days, chosen at creation. Only the SHA-256
  hash is stored; the token is answered once, in the `POST` that creates it. An admin keeps at most
  10 live tokens, each with a name, and revokes them one by one. The last use is recorded at most
  every five minutes, as for sessions.
- **Who creates them:** the signed-in admin, from the dashboard (`GET`, `POST /v1/me/tokens`,
  `DELETE /v1/me/tokens/{tokenId}`), with the same `Origin` check as every session write. A token
  cannot mint, list or revoke tokens.
- **Limits:** 60 requests a minute per token, counted on a hash of the header, in memory per
  execution environment like the other limits. Requests without the header use the session and
  are not counted against it.

## Consequences

- An agent sees the same numbers as the dashboard, from the same projects, with the same 404 for
  a project it may not read. A leaked token shows numbers and changes nothing; it stops working
  the moment it is revoked, because tokens are looked up by hash on every request with no cache.
- The tokens' rows stay after they expire or are revoked; ten live per admin bounds what is
  active, not what is kept. Deleting old rows in the daily job is a later step if they ever weigh.
- The OpenAPI document lists the `access_token` scheme beside the session on each query, so a
  client generated from it knows which routes a token may call.
