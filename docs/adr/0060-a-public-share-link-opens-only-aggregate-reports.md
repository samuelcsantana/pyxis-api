# 60. A public share link opens only aggregate reports

Date: 2026-11-05

## Status

Accepted. Builds on [ADR 0057](0057-pro-features-are-gated-by-the-account-status.md) (the Pro
feature gate), [ADR 0058](0058-goals-replace-the-conversion-event.md) (goals) and the secret key
and access token records, which keep a credential only as its hash.

## Context

Agencies and teams want to show a site's figures to someone without an account: a client, a
board, a public page. Every dashboard route needs a session or an access token, and both belong
to a person who can read every report of the project, including the ones that follow one visit or
one person (Visits, the Timeline, Requests with their session ids, the people of a funnel step).

A link that anyone holding it can open is a bearer credential that travels by chat and e-mail. It
must open less than a session, be easy to take back, and say nothing about why it stopped working.

## Decision

1. **A share link is a token kept only as its SHA-256 hash.** `pyxis_sh_` and 32 letters and
   digits (about 190 bits), drawn like the access tokens, answered once when the owner creates
   the link and never again. The table `share_links` holds the project, a name for the owner,
   the creation and an optional expiry, and a nullable `password_hash` that stays empty until an
   optional password is built; nothing reads it yet.
2. **Only the account's owner manages links, from the dashboard.** `POST`, `GET` and `DELETE`
   under `/v1/projects/{projectId}/share-links`, with the session and, for the writes, the
   dashboard origin. A person the project was shared with gets the same 404 as a stranger.
   Creating one calls `requireProFeature(account, 'public_share_link')`, after the usual access
   checks; listing and revoking work on any plan, so an account that left Pro can still take its
   links back. At most ten links per project, expired ones included until revoked.
3. **Revoking deletes the row.** The hash is gone, so the token can never open again, from the
   next request on. There is no "disabled" state to undo.
4. **The public routes are an allowlist of aggregate reports.** `/v1/shared/{token}` answers the
   project's name, time zone, currency, the two counting options and its goals; under it,
   `overview`, `time-of-day`, `goals/summary`, `acquisition`, `devices`, `features`, `engagement`,
   `funnel` and `funnel/segments` answer exactly what the dashboard route of the same name
   answers, with the same parameters, the same use cases and the same answer builders, so a
   shared report cannot drift from the dashboard's. The parameters are the range, `goal`, funnel
   steps and every visit filter but two: `identity` (identified or anonymous visits) and
   `property` (an event's `key=value`). With a short range and the other filters, the first
   isolates the few visitors who signed in, and the second narrows a total to the visit that
   carried one order or customer id; either would turn a sum into one person's data. The
   shared routes answer `400` to them and to any unknown parameter, rather than ignoring them.
   The filters kept (path, event name, channel, device, browser, system, place, source,
   campaign, failed requests, reached goal) only cut the counts these reports already show. Nothing that lists a visit or a person exists under `/v1/shared`: no visits, no
   timeline, no requests, no funnel subjects, no settings, no keys. Event property breakdowns
   are left out too: a property value is free text the site chose and can be an order or
   customer id, while the reports above only count.
5. **One answer for every closed link.** A token of the wrong shape, a token never issued, a
   revoked or expired link, an account no longer on Pro, a suspended account or a deleted
   project all answer `404 share_link_not_found` with the same body. A holder of an old link
   learns that it no longer opens, never why, and cannot tell an account's plan or suspension
   from outside. The plan is read on every request, as ADR 0057 decided: a link of an account
   that comes back to Pro opens again. A project outside any account, the operator's own, may
   share as it may use every Pro feature.
6. **Rate limited per client address, before the token is looked at.** 120 requests a minute per
   address, with the client address read from `CloudFront-Viewer-Address` through the existing
   `getClientIp`, so guessing tokens costs the same as reading reports. The dashboard's origin
   may call these routes from the browser, so each viewer is counted by their own address rather
   than the dashboard server's.
7. **The token travels in the path.** The public page is `/share/{token}` on the dashboard, and
   the API mirrors it, so a browser can read the reports with a simple `GET`. Neither the API nor
   CloudFront logs request paths, and the answers carry `Referrer-Policy: no-referrer` and
   `Cache-Control: no-store` like every other route. Keeping the page out of search engines is
   the dashboard's job (`noindex`).

## Consequences

- A shared figure always equals the dashboard's for the same query: the end-to-end tests compare
  every shared report with its dashboard twin.
- Adding a report to the share page is adding one route to the allowlist, reviewed against the
  rule in point 4; a route that lists visits or people is never added.
- The optional password fills `password_hash` and adds a check after the token's, without a
  migration of existing links.
- A link that keeps working after a person leaves the client's company is the owner's to revoke;
  the optional expiry exists for links meant to end.
