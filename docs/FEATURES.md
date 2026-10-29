# Features

Everything the API does, in full: the limits, the edge cases and the decision behind each rule.
The [README](../README.md) has the short list, and every route with its parameters and answers is
in the [API reference](https://samuelcsantana.github.io/pyxis-api/).

- Health endpoint, strict security headers and a request id on every response
- OpenAPI 3.1 document generated from the routes' own Zod schemas, with Swagger UI outside
  production
- PostgreSQL through Drizzle, with migrations run by the owner role and the API connected as a
  least-privilege role that can read and write rows but never change the schema
- `POST /v1/batch`: batched ingestion with a public project key and a per-project origin
  allowlist, as `text/plain` (no CORS preflight, `sendBeacon`-friendly) or `application/json`.
  Invalid events are rejected one by one while the rest of the batch is stored
  ([ADR 0005](adr/0005-per-event-validation.md)); a resent event is a duplicate, never stored
  twice; bots are rejected, both those that say so and clients that are no browser (no user agent,
  the `compatible;` form robots use, or no known browser and system;
  [ADR 0045](adr/0045-a-client-that-is-no-browser-is-refused.md)), and so are batches sent
  from cloud data centers, by the network CloudFront reports
  ([ADR 0046](adr/0046-traffic-from-cloud-data-centers-is-refused.md))
- A server-side barrier that drops any property or campaign value that looks like an email, a
  phone number or a tax id, and re-templates paths
- Device, browser, operating system, channel, country and region derived on the server; the user
  agent and the address are read, classified and discarded, and the city is never read
  ([ADR 0014](adr/0014-store-the-region-never-the-city.md))
- Dashboard sign-in with a six-digit code sent by email, exchanged for an opaque session in an
  `HttpOnly` cookie that is checked on every request and revoked at sign-out; `GET /v1/me` lists
  the admin's projects, each with when its first and its latest events happened (null before
  any), so the dashboard can tell a project still waiting for its first event from a quiet
  period. A person gets in through sign-up, an account owner's invitation or the operator's
  `admin:grant` ([ADR 0007](adr/0007-email-code-sign-in-with-opaque-sessions.md))
- A branded sign-in email with a plain-text twin: the code first in the subject and in the
  hidden inbox preview, then in a large monospace block a double-click copies whole; how long it
  lasts, that it works once, never to share it, and what to do if the sign-in was not yours.
  Table layout with inline styles for every client, light and dark through `color-scheme` and
  `prefers-color-scheme`, `lang` and presentation-only tables for screen readers; every value
  HTML-escaped, no tracking pixel and no tracked links. Its only image is the dashboard's PNG
  logo (`/email/pyxis-logo.png` on `DASHBOARD_ORIGIN`, which every link in the e-mails points
  at too), and its words live in a typed message table in English, Brazilian Portuguese,
  Spanish, German, French, Italian and Dutch. The dashboard sends its own language as an
  optional `locale` in `POST /v1/auth/request-code` (`{"email":…,"locale":"pt-BR"}`), matched
  on the language (`pt-PT` gets pt-BR, `es-MX` gets Spanish, `de-AT` gets German); no `locale`,
  or one the API has no email for, gets English, so sign-in never fails over a language
- Dashboard queries over any range of up to 400 days in the project's time zone:
  `GET /v1/projects/{projectId}/overview` (visits, identified users, conversions and failed
  writes against the previous period, daily activity of both periods, top pages and events; a
  range that ends today is compared with the previous period up to the same time of day, and the
  answer says which time that was:
  [ADR 0010](adr/0010-compare-an-unfinished-day-up-to-the-same-time.md)),
  `/devices` (device type, browser, system and country, top five and "other", plus the top ten
  regions, "other" and the visits without a region) and
  `/acquisition` (visits per day and channel, sources and campaigns with conversions and ad
  clicks; a visit's source is its campaign source, else its referring host, else `(ad click)`
  when it came from an ad click, else `(direct)`); wherever
  conversions are counted, both the conversion events and the converting visits (visits that
  sent the conversion event at least once) are given, so a conversion rate never passes 100 %,
  `/features?kind=events|screens` (the most used named events or screens, with daily counts) and
  `/features/properties?name=` (how one named event's property values break down: per key, the
  ten most frequent values with their count and visits, and the count of the rest),
  `/features/properties/summary?name=&key=&by=` (the median and the 25th and 75th percentiles
  of one property of a named event, counting only the events where it is a JSON number, such
  as the seconds of `article_read_100`, and with `by` the same per value of another property of
  the event, the ten most carried values first, with the count of the rest) and
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
  browser, system, country, region, source, campaign, whether it was identified, a request route
  (`POST /orders/:id`) and
  whether a request, or a request to that route, failed; a visit is one browser tab, and nothing
  links two of them) and
  `/settings` (read-only: time zone, conversion event, allowed origins, first and latest event,
  how many months events are kept, the live public keys, and when each live secret key was
  created; a secret key never leaves the API, not even as its hash) and
  `/time-of-day` (for each weekday, Monday first, and each local hour, the visits whose first page
  view happened then; the grid adds up to the visits of the range) and
  `/engagement` (the top entry and exit pages, the visits that viewed a single page, and the visit
  length from the first to the last event: the median and seven buckets) and
  `/arrivals?since=<instant>` (what reached the project after that moment and happened inside the
  range, kind by kind: the arrival times of visits, conversions, named events and failed
  requests, newest first, rounded up to the second, at most 100 each with `more` beyond them, and
  the visits with an event in the last five minutes; the moment counts from 7 days ago at the
  earliest; only times and counts, no ids; 30 asks a minute per session or token:
  [ADR 0044](adr/0044-arrivals-are-counted-by-reception-time.md)). Times are UTC
  instants; the answers that list them (`/requests`, `/funnel/subjects`, `/timeline` and
  `/visits`) also carry the project's `timezone`, so a client shows them in local time without
  asking for the settings first. Every report but `/arrivals` and `/timeline` takes the filters
  of `/visits` except `route` (`/overview?from=…&to=…&device=mobile&channel=paid`): a filter
  selects visits, and every number counts the events of those visits only, in the range and in
  the previous period; without a filter the answers are unchanged
  ([ADR 0047](adr/0047-a-filter-selects-visits.md)). A project
  the admin may not read answers the same 404 as one that does not exist
  ([ADR 0008](adr/0008-dashboard-queries-on-raw-events.md))

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
  granted, and nothing else ([ADR 0015](adr/0015-read-only-access-tokens-for-agents.md))

- An OAuth 2.1 server for the Claude connector, behind `REMOTE_MCP_OPEN` (off by default, every
  OAuth address answers 404 until it is on): the issuer metadata at
  `/.well-known/oauth-authorization-server`, `/oauth/authorize` (PKCE S256 required), `/oauth/token`
  and `/oauth/revoke`. Only Claude and Claude Code connect, known by the address of their client
  metadata document, which is fetched from those two addresses only. The person consents on the
  dashboard's `/connect` page, which reads and answers the request through
  `GET /v1/oauth/requests/{id}` and `POST …/approve` or `…/deny`. A connection holds a one-hour
  access token (`pyxis_oat_`) that reads exactly what a read-only token reads, and a refresh token
  (`pyxis_ort_`) traded once: presenting a traded one after a minute ends the connection. People
  see and end their connections with `GET` and `DELETE /v1/me/connections`
  ([ADR 0037](adr/0037-the-api-is-its-own-oauth-server-for-claude.md))

- The remote MCP server at `POST /mcp`, behind the same switch: the sixteen read-only tools of
  [`pyxis-mcp`](https://github.com/samuelcsantana/pyxis-mcp), over stateless Streamable HTTP with
  JSON answers. It takes the access token of a connection (`pyxis_oat_`) or a read-only token
  (`pyxis_at_`, for applications that send a header instead of signing in) and nothing else.
  Without a token, or with a refused one, it answers 401 with `WWW-Authenticate` naming the
  protected resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource/mcp`, also
  served at `/.well-known/oauth-protected-resource`, which names the API as the authorization
  server. Each tool runs inside the API as a `GET` of the route it reads, with the caller's token,
  through the same guards, limits and project scope as the dashboard; the token never leaves the
  API. A token sends 120 messages a minute to `/mcp`, and its tool reads count against the read
  routes like any other request with it
  ([ADR 0038](adr/0038-the-mcp-endpoint-runs-the-tools-inside-the-api.md))

- Accounts for the hosted plan: an account is who pays, with one owner and the projects it holds
  (3 at most on the paid plan and 1 on the free plan, counted under a lock so two requests cannot
  both take the last place). A project without an account is the operator's own, as every
  project was before, with no plan and no quota
  ([ADR 0016](adr/0016-accounts-own-projects.md))
- A monthly quota for those accounts: the daily job counts each account's events in the current
  calendar month (UTC) and keeps the figure; an account past its plan's pause point (150% of the
  paid plan's 100,000 events, 100% of the free plan's 10,000) is paused until the month turns, and
  its batches are answered `403 quota_exceeded`, readable by the site's origin so the tracker
  drops them instead of retrying. Accounts the operator gives (`comped`) and the operator's
  projects are never paused
  ([ADR 0017](adr/0017-monthly-quota-measured-daily.md)). The owner is told by e-mail once
  per level and month, in their language: at 80%, at 100% (nothing is cut off) and when the pause
  starts; a failed e-mail is tried again the next day, and the optional `SUPPORT_EMAIL`, named in
  the footer of every e-mail, receives the replies. The operator can exempt an account from the pause until a day
  (`account:exempt-quota`), for a customer of an earlier version of the terms until its renewal:
  it is neither paused nor told of a pause before that day, and `GET /v1/me/accounts` shows
  `quota_pause_exempt_until` ([ADR 0034](adr/0034-an-account-can-be-exempted-from-the-pause.md))
- A larger plan for one account: the operator gives it its own monthly events, projects and people
  (`account:limits`), used by the measurement, its notices, project creation, adding people and
  `GET /v1/me/accounts`; lowering a limit deletes nothing
  ([ADR 0036](adr/0036-a-larger-plan-is-limits-on-the-account.md))
- A free plan, as the account status `free`: 10,000 events a month, 1 project and 1 person, the
  owner alone, with every feature; it has access and no subscription, its owner gets the notices
  sent to every owner, the operator's limits still apply on top, and its measuring pauses at
  100% of the month instead of 150%: its notices are the 80% warning and the pause, which speak
  of the free plan's limit and link to subscribing in Account and billing. `GET /v1/me/accounts`
  answers `pause_at_events`, so the dashboard never copies the ratio
  ([ADR 0048](adr/0048-a-free-plan-is-a-status-with-its-own-limits.md))
- Sign-up into the free plan, without a card, behind `FREE_PLAN_OPEN`: completing sign-up takes a
  place while the plan holds fewer than `FREE_ACCOUNTS_MAX` accounts (counted under a Postgres
  advisory lock, so two sign-ups never share the last place), and turns an owner's unfinished
  account into a free one. At the cap the account waits, marked `free_waitlisted_at`, for up to 60
  days; the daily job opens the places left to those who waited longest. A free account is
  welcomed at sign-up with its limits, the deletion of an unused free account and the terms
  accepted. `GET /v1/auth/sign-up` answers `free_plan` (`open`, `full`, `closed`), counting the free
  accounts at most once a minute per instance, and the verify answer the `account_status`
  ([ADR 0049](adr/0049-sign-up-without-a-card.md))
- One free account per mailbox: every admin has a `mailbox`, generated by Postgres from the
  address (without its `+tag`, and on Gmail without dots, `googlemail.com` read as `gmail.com`).
  A mailbox that already has a free account, or one waiting for a place, gets no free place and
  no place in the queue, at sign-up, when places open and when a subscription falls back to free;
  the verify answer says so in `free_place` (`placed`, `waitlisted`, `taken_by_same_mailbox`,
  `not_offered`). Aliases stay separate people everywhere else
  ([ADR 0053](adr/0053-one-free-account-per-mailbox.md))
- Subscribing from the free plan, never with a trial (the trial of an unfinished sign-up follows
  `TRIAL_OFFERED`): when it pays, the webhook lifts the month's pause at once, resets the month's
  notices and confirms the subscription by e-mail (the daily job sends any still due); a
  subscription that never ran or was cancelled leaves a free account free.
  `POST /v1/accounts/{accountId}/withdraw` withdraws within 7 days of the first payment: it cancels
  at once, refunds that payment and puts the account back on the free plan with its data, with an
  e-mail; `409 withdrawal_window_closed` after the 7 days
  ([ADR 0050](adr/0050-subscribing-from-the-free-plan-and-withdrawing-back-to-it.md))
- Falling back to the free plan: when Stripe ends a running subscription (cancelled at the end of
  its period, or unpaid), the webhook and the daily reconcile put the account on `free` instead of
  ending it, if the free plan is open, the owner is bound by terms with the free plan (version 1.3
  or later accepted, or `FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM` passed) and its projects and
  people fit; it keeps its Stripe customer, keys and data, and the owner gets a `back_to_free`
  e-mail. A withdrawal that leaves an account over the free plan answers `fit_by`, 30 days ahead:
  the daily job ends the account on that day if it still does not fit. `GET /v1/me/accounts`
  answers the owner the `project_count`, `people_count`, `free_plan_fit_due_at`,
  `bound_by_free_plan_terms` and `mailbox_has_another_free_account` (another free account of the
  owner's mailbox, ADR 0053), so the dashboard promises the fallback only where the API makes it
  ([ADR 0051](adr/0051-an-ended-subscription-falls-back-to-the-free-plan.md))
- Free accounts with no events: the daily job warns the owner of a free account that stored no
  event in the 30 days after it entered the free plan (`free_since`), or none for 90 days in a row,
  with the deletion day seven days ahead, and deletes it then unless an event was stored in the
  meantime; replying to the notice asks a person to review it. Only stored events count; paid and
  comped accounts, deletion holds and suspended accounts are never touched
  ([ADR 0052](adr/0052-free-accounts-with-no-events-are-deleted.md))
- Free accounts that share a site: the daily job reports each project of a free account with an
  origin that a project of another account (not ended) or of no account also allows, as
  `accounts.free_site_shared` at warn level with the account and project ids only, and counts the
  free accounts in `freeAccountsSharingASite`. Origins of a developer machine (`localhost`,
  `*.localhost`, `127.0.0.1`, `[::1]`) do not count. It reports and blocks nothing: the same site
  in two accounts can be an agency and its client, and refusing an origin would tell a stranger
  that someone else measures it

- Billing through Stripe: `POST /v1/billing/stripe/webhook` takes Stripe's signed events (raw body,
  up to 512 KB), applies each one once (`billing_events`), always re-reads the subscription before
  changing the account (trialing, active, past due, ending with the date access ends, ended), and
  answers 503 when Stripe cannot be read so Stripe sends the event again. `account:link` ties a
  subscription paid through a payment link to an account
  ([ADR 0018](adr/0018-billing-follows-stripe-through-its-webhook.md))
- Repeated free trials: the subscription is read with its card, and the card's Stripe
  fingerprint (never the number) is recorded once per account while the subscription is trialing
  (never after, though Stripe keeps the trial's end date on the subscription); a card that
  already started a trial in another account is logged as `billing.repeated_trial` and raises an
  alarm, and nothing else happens. The records outlive their account and are deleted after twelve
  months ([ADR 0026](adr/0026-repeated-trials-are-detected-not-blocked.md))
- Sign-up, closed until `SIGNUP_OPEN=true`, a `TERMS_VERSION` and a `TERMS_URL` are set (otherwise
  `404`):
  `GET /v1/auth/sign-up` says whether it is open and which terms to show, with their address;
  `POST /v1/auth/sign-up/code` e-mails a code (202 for any address, silent at the per-address
  limit; `429 sign_up_busy` for every address once 50 sign-up codes were created in the last 24
  hours, logged as `auth.sign_up_daily_cap`, which an alarm watches); `POST /v1/auth/sign-up/verify` takes the code and the terms version
  accepted (`409 terms_outdated` if it is not the current one), records the acceptance and answers
  a session and an `incomplete` account. `GET /v1/me/accounts` lists the admin's accounts with
  their billing state and the month measured; `POST /v1/accounts/{accountId}/checkout` opens
  Stripe Checkout (while `TRIAL_OFFERED` is `true`, with the 14-day trial the first time and a
  line above the button saying it is one per customer; with a field for a promotion code made in
  Stripe while `PROMOTION_CODES_OPEN` is `true`) and `.../portal` the billing portal, for
  the owner only. An ended account not yet deleted subscribes again through the same Checkout, with
  no trial, even while sign-up is closed, and leaving that Checkout goes back to `/account`
  ([ADR 0019](adr/0019-sign-up-behind-a-switch-and-the-terms-version.md))
- Projects managed by the owner of their account, from the dashboard (origin and session
  required): `POST /v1/accounts/{accountId}/projects` (within the plan's projects), `PATCH
/v1/projects/{projectId}` (name, up to five origins, time zone, conversion event),
  `POST /v1/projects/{projectId}/delete` (the name typed again), `POST
/v1/projects/{projectId}/keys` (a secret key is shown once; five live keys of each kind) and
  `DELETE /v1/projects/{projectId}/keys/{keyId}` (only a key of that project; the last public key
  stays). Anyone else gets 404; an account without access (no running subscription, and neither
  free nor comped) gets `409 subscription_required`. The project settings say the admin's `role`
  ([ADR 0020](adr/0020-owners-manage-their-projects-from-the-dashboard.md))
- People of a project: `GET /v1/projects/{projectId}/people` for anyone who reads it; the owner
  adds an address (`POST`, with an invitation e-mail in the language of the page) and takes
  someone off (`DELETE .../people/{adminUserId}`). The plan's people (3 on the paid plan, 1 on the
  free plan) are counted across the account's projects, the owner included, under the account
  lock; the owner always stays
  ([ADR 0021](adr/0021-people-are-counted-across-the-account.md))
- The end of a hosted account, run by the daily job: subscriptions reconciled with Stripe, keys
  revoked when access ends, the owner told and reminded by e-mail, everything deleted thirty days
  later (events in batches), and sign-ups that never subscribed removed after seven days; each step
  once, recorded on the account ([ADR 0022](adr/0022-an-account-ends-in-steps.md))
- People left without any project and without an account of their own, deleted by the daily job
  thirty days after it first finds them alone, with their sessions and tokens; getting a project
  back clears the count ([ADR 0031](adr/0031-people-without-a-project-are-deleted.md))
- The welcome e-mail, sent by the webhook as soon as an account gains access (the trial end, the
  first step, the version and address of the terms accepted), with the daily job sending it to any
  signed-up account the webhook could not welcome
  ([ADR 0023](adr/0023-the-welcome-follows-the-subscription.md))
- Exports for the owner, in any account state: `POST /v1/projects/{projectId}/exports` (202; one
  waiting, three a day) hands the export to the jobs function, which writes the events as a gzipped
  CSV to a private bucket that deletes it after a week and e-mails the owner; `GET
.../exports/{exportId}` shows it with a download link signed for five minutes
  ([ADR 0024](adr/0024-exports-are-files-with-short-links.md))
- Closing an account, by its owner with the e-mail address typed again: `POST
/v1/accounts/{accountId}/close` cancels the subscription at once, refunds in full a first payment
  made in the last seven days, revokes every key of the account's projects and e-mails the date
  everything is deleted, thirty days later; the daily job does the rest
  ([ADR 0025](adr/0025-the-owner-closes-the-account-at-once.md))
- Suspending an account for abuse from the operator's command line (`account:suspend`,
  `account:resume`): within a minute its batches are answered `403 account_suspended`, readable
  by the site so the tracker drops them, and its project screens and changes refuse sessions and
  read-only tokens alike; sign-in, the account and its reason, billing, closing, exports and the
  secret-key erasure stay open, and the subscription is never touched
  ([ADR 0027](adr/0027-a-suspension-is-a-mark-not-a-status.md))
- Suspending the event reception of a single project (`project:suspend`, `project:resume`):
  within a minute its batches are answered `403 project_suspended`, readable by the site, while
  its screens, exports and people stay open; `GET /v1/me` and the project settings show the
  suspension to everyone who reads the project and the reason to the account's owner
  ([ADR 0032](adr/0032-a-project-reception-can-be-suspended-alone.md))
- Closing an account as the operator (`account:close --refund full|prorata|none`): cancels the
  subscription, refunds the latest paid invoice in full, by the whole days left (from the start of
  a suspension when there was one) or not at all, and ends access with the same closure as the
  owner's; a failed refund never keeps the account open
  ([ADR 0028](adr/0028-the-operator-closes-an-account-with-a-chosen-refund.md))
- Holding the deletion of an account for a dispute or a legal order (`account:hold`,
  `account:release`): the daily job neither reminds nor deletes it, its owner cannot delete its
  projects (`409 deletion_on_hold`) and sees the hold, not the reason
  ([ADR 0029](adr/0029-a-deletion-can-be-held.md))
- Holding the deletion of one project (`project:hold`, `project:release`): its owner cannot delete
  it, the deletion of its account keeps it and the account, and the retention keeps its events,
  as it now does for a held account too; the project settings show `deletion_held_at`
  ([ADR 0033](adr/0033-a-hold-keeps-everything-it-covers.md))
- Notices to every account owner (prices, terms, a new subprocessor, a long outage):
  `notice:create --campaign <name> --dir <folder>` reads one file per e-mail language
  (`en.txt`, `pt-BR.txt`, `es.txt`, `de.txt`, `fr.txt`, `it.txt`, `nl.txt`: a subject line, then
  plain paragraphs, never interpreted as HTML or Markdown), counts the owners
  reached with `--dry-run`, and stores one pending delivery per account with access
  (`--include-ended` adds the ended ones not yet deleted). The jobs function sends them in each
  owner's language, once, on its daily run or when invoked with `{"job":"account-notices"}`, and
  picks up where it stopped ([ADR 0035](adr/0035-notices-to-every-owner-go-through-the-jobs-function.md))
- Stopping one person, one token or one connection from the command line: `admin:suspend` ends
  every session, token and connected application of the person and keeps them from signing in
  again until `admin:resume` (no code is sent, and a session that survived is refused),
  `token:revoke` revokes any read-only token by its id and `connection:revoke` ends any connected
  application by its id ([ADR 0030](adr/0030-the-operator-can-stop-a-person-and-a-token.md))
- A reviewer code, for the reviewers of a connector directory, who cannot read a code sent by
  e-mail: `reviewer:open --email <address>` gives an existing admin six digits, printed once and
  kept only as a hash, that sign in as an e-mailed code does, as often as needed, for a year by
  default (365 days at most). While it is open the address is e-mailed no code; 20 wrong codes
  close it, and `reviewer:close` ends it at once ([ADR 0040](adr/0040-a-directory-reviewer-signs-in-with-a-code-the-operator-opens.md))
- Demo traffic for a project of the operator, so a reviewer reads a populated project without
  anyone's real numbers: `project:demo-traffic --project <id>` marks it (never a project of an
  account), and the daily job fills it with the invented visits of a store, 25 to 62 a day,
  from 90 days back the first time, then each new day up to the moment it runs. The same day
  always gives the same events and ids, so a run never adds a day twice; `--off` stops it
  ([ADR 0041](adr/0041-a-demo-project-is-filled-with-invented-visits-every-day.md))

- `DELETE /v1/subjects/{userId}` erases a person's events, including the anonymous part of the
  visit they identified in, and `GET /v1/subjects/{userId}/events` exports them, both from the
  site's backend with a secret project key
  ([ADR 0009](adr/0009-erase-a-person-with-their-linked-visits.md))

- A daily job deletes events older than 13 months, then expired dashboard sessions and sign-in
  codes, the cards of trials started more than twelve months ago and the ended connections, spent
  connection tokens and finished authorization requests, then measures each account's
  month (the quota); each step logs its count, and a failed step fails the run so the scheduler
  retries.
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
  e-mail does not stop the others ([ADR 0011](adr/0011-weekly-digest-from-the-jobs-function.md))

## Privacy and security, in detail

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
  CloudFront, never from the IP, and the city is never read. The network number CloudFront
  reports is read only to refuse batches from cloud data centers, and never stored
- Strict response headers: a CSP that loads nothing, no framing, nosniff, no referrer, HSTS and
  `no-store` by default
- `X-Forwarded-For` is never trusted for the client address
- Ingestion is rate-limited per client address (120 batches a minute) and per project (3,000 a
  minute), in memory per execution environment: no counter, not even a hash of an address, is
  stored. The function's reserved concurrency bounds the global worst case
- A resolved project key is cached for 60 seconds per execution environment, so revoking a key
  takes up to a minute to take effect everywhere. An unknown or revoked key is remembered as
  unknown for the same 60 seconds (at most 1,000 of them, the oldest forgotten first), so a site
  that keeps sending one costs a database query a minute per execution environment, not one per
  batch; keys are random and created by the API, so no key is ever asked for before it exists
- The ingestion route never answers CORS with credentials. An accepted batch is readable only by
  the project's allowed origin; a batch refused for its key or its origin (`401 unknown_key`,
  `403 origin_not_allowed`) is readable by the origin that sent it, so the tracker drops it
  instead of retrying, and it learns only the error code `curl` gets for the same body
  ([ADR 0039](adr/0039-a-refused-batch-is-readable-by-its-page.md))
- A dashboard query for a project the admin was not granted answers exactly like one for a
  project that does not exist (404 `not_found`), so the API never confirms that a project exists
- The weekly digest carries aggregates, paths, event names and routes only, never a user id or a
  link to a visit, and its logs name projects and admins by id, never by address
- Dashboard sign-in never says whether an email belongs to an admin (always 202, empty body).
  Codes and session tokens are stored only as SHA-256 hashes; a code allows five guesses and one
  use, and expires in 10 minutes. A reviewer code is stored the same way and counts its wrong
  guesses, closing at 20; a right one does not count. Sessions end after 7 days, after 24 hours idle, at sign-out,
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
- The dashboard asks `/arrivals` every 30 seconds while a tab is visible, so it has a limit of its
  own: 30 asks a minute per session, access token or connection, counted after the credential is
  authenticated and the project's access checked. It is not counted per address, because every
  dashboard read reaches the API from the dashboard's servers. Each route names the throttlers it
  uses and skips every other registered one, so a new limit never lands on another route
- A connected application's tokens are 256 random bits each, stored only as SHA-256 hashes and
  bound to one person and one client. The code works once, for five minutes, and only with the
  PKCE verifier of its challenge; a code presented twice ends the connection it made, and so does a
  refresh token presented again more than a minute after it was traded. Within that minute a
  replay gets another pair only while the connection holds fewer than three live access tokens.
  The client's return address must be one its own metadata document lists (any port only for a
  loopback address registered without one), and an unknown client or return address is never
  redirected to. The token endpoint has no limit an address shares with every user of the same
  client, only a circuit breaker; its errors follow RFC 6749
- The MCP endpoint reads only with a bearer token, never with the dashboard's session cookie, and
  refuses a request that carries an `Origin` header, so a web page cannot drive it, DNS rebinding
  included. Its tools can only send `GET` requests, in process, to the API's own origin, and
  every answer marks the visitors' texts (event names, property values, paths) as untrusted for
  the model that reads them. A message is at most 32 KiB
- Fetching a site's icon is the API's only request to an address it does not choose: https only,
  the host resolved before every request (redirects too, at most three, followed by hand) and
  refused when any address is loopback, private, link-local, carrier-grade NAT, unique-local,
  multicast or reserved, five seconds per request, the home page read up to 512 KB and the icon
  up to 100 KB, and the image accepted only when its first bytes are a PNG, ICO, JPEG, WEBP or
  GIF, never SVG. The icon is served with the same strict headers as every response
- Secrets live in AWS Parameter Store, never in the repository; secret scanning and push protection
  are on
- Vulnerabilities: see [SECURITY.md](../SECURITY.md). An advisory with no fixed version that reaches
  only the test tools, never the Lambda image, is skipped in `osv-scanner.toml` with its reason
