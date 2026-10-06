# 7. Sign admins in with an emailed code and an opaque session cookie

Date: 2026-10-05

## Status

Accepted

## Context

The dashboard is read by a handful of operators, each allowed to see some projects. It needs a
sign-in that has no password to store or reset, that a stranger cannot use to learn who the
admins are, and whose sessions can be ended at once. The dashboard and the API live on different
hosts of the same site (`pyxis.samuelsantana.dev` and `api.pyxis.samuelsantana.dev`), so the
browser calls the API cross-origin with credentials.

## Decision

- **No sign-up.** An email becomes an admin only through the `admin:grant` script, run by the
  operator with the database owner's connection.
- **A six-digit code by email.** `POST /v1/auth/request-code` always answers 202 with an empty
  body. Only for an admin does it store a code's SHA-256 hash, valid for 10 minutes, and email the
  code through Resend; at most five codes per email per hour. Outside production the code is
  logged instead of emailed, and production refuses to start without a Resend key, so a code is
  never logged there.
- **Bounded guesses, single use.** Each exchange counts an attempt atomically
  (`attempts < 5` in the `UPDATE`); the fifth wrong guess kills the code, even for the right one.
  The winning exchange claims the code with an `UPDATE … WHERE used_at IS NULL`, so two exchanges
  of the same code at the same moment open one session, not two.
- **Opaque sessions, not JWTs.** A successful exchange creates a 32-byte random token. The
  database keeps only its SHA-256 hash; the browser keeps the token in a cookie
  `pyxis_session` that is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, seven days long, scoped
  to `SESSION_COOKIE_DOMAIN` so the dashboard's own server receives it too. Every request looks
  the session up: it ends after seven days, after 24 hours without use, or at sign-out, which
  revokes it at once. The last use is written at most every five minutes.
- **Only the dashboard may call.** The sign-in routes refuse any request whose `Origin` is not
  `DASHBOARD_ORIGIN`, on top of `SameSite=Lax`, which closes login CSRF. CORS on `/v1/auth/*` and
  `/v1/me` grants credentials to that origin alone and always sends `Vary: Origin`; ingestion keeps
  its own credential-less CORS.
- **Rate limits per address**, in memory like ingestion's: five requests every fifteen minutes on
  each of `request-code` and `verify-code`.

## Consequences

- Nothing a stranger can do tells them whether an email is an admin's: same status, same empty
  body. The code path does more work for a real admin, a timing difference we accept because the
  per-address and per-email limits keep it from being a practical oracle.
- Signing out, or deleting a session row, ends access immediately; no token outlives its row.
  The price is one indexed lookup per dashboard request.
- No secret is shared between services and nothing needs rotating: the only key is Resend's.
- Emails and tokens never appear in logs, and codes only outside production; sign-in logs carry
  the admin's id at most.
- An admin who mistypes the code five times asks for a new one, and an address that exhausts its
  window waits up to fifteen minutes.
- Which projects a session may read is checked by the query routes, which arrive after this
  decision.
