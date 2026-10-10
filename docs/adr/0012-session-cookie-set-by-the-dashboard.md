# 12. Let the dashboard keep the session in a cookie of its own host

Date: 2026-10-10

## Status

Accepted. Amends [ADR 0007](0007-email-code-sign-in-with-opaque-sessions.md), which had the API
set the session cookie.

## Context

The dashboard lives on `app.pyxis-analytics.dev` and the API on `api.pyxis-analytics.dev`. The
browser signs in by calling the API directly, so the API set the session cookie, and for the
dashboard's server to receive it the cookie had to be scoped to the parent domain,
`pyxis-analytics.dev`. The browser then sent an admin's session token to every host under that
domain: the live demo, the apex and any host created there later. Nothing read it, the cookie was
`HttpOnly`, and no sibling host ran third-party code, so nothing was exposed; but the scope was the
one structural place where a session could leak, and it would widen silently with every new
subdomain.

A cookie scoped to the dashboard's host alone can only be set by the dashboard. Two ways were
considered:

- The dashboard's server signs in on the browser's behalf and sets the cookie. The API would then
  see the dashboard's egress address for every sign-in, and its per-address limits on the sign-in
  routes would have to trust an address forwarded by the dashboard, which needs a shared secret
  between the two.
- The browser keeps calling the API, which answers the token in the body; the page hands it to a
  Server Action of the dashboard, which sets a host-only cookie. The per-address limits keep seeing
  the real browser. The token is readable by the page's JavaScript for the instant between the
  answer and the action; a script injected at that moment could read it, which is what the
  dashboard's nonce-based Content Security Policy makes hard.

## Decision

- `POST /v1/auth/verify-code` answers `{ email, session_token }`. The token is the same opaque
  32-byte value as before, stored only as a SHA-256 hash and never logged.
- The dashboard keeps it in `__Host-pyxis_session`: `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/`, no `Domain`, the same seven-day lifetime. The `__Host-` prefix makes the browser refuse
  the cookie if any of that is missing.
- The dashboard's server keeps sending the token to the API as the `pyxis_session` cookie on every
  call, and signs out by calling `POST /v1/auth/logout` with it. The API does not change how it
  reads sessions.
- The API stops setting a cookie once the dashboard sets its own, and the `SESSION_COOKIE_DOMAIN`
  setting goes away. Until then both are set, so either dashboard version signs in.

## Consequences

- No host other than the dashboard's ever receives a session token.
- One forced sign-in for every admin when the dashboard switches cookies. The old parent-domain
  cookie stays in the browser for up to seven days, but its session expires on the API after a
  day without use, so it is not cleared from the dashboard.
- The sign-in flow has one more step on the dashboard's server, covered by Next's own origin
  check on Server Actions, which also prevents a cross-site page from planting a session cookie.
- The API's OpenAPI document gains the `session_token` field on `SignedIn`.
