# 44. Arrivals are counted by reception time, as times not counts

Date: 2026-10-23

## Status

Accepted.

## Context

The dashboard is going to show what is new on each screen since the admin last looked at it: a
count beside each item of the menu, a "N new · Refresh" bar on the open screen and "now on the
site" on the Overview. It asks every 30 seconds while a tab is visible. A stream (Server-Sent
Events or a WebSocket) was weighed and declined: the HTTP function and CloudFront end a response
at 30 seconds, the function URL only answers whole responses, the same function takes the sites'
events with ten reserved executions that an open connection would hold, Postgres would still be
asked, and the browser would need the session to reach the API directly.

Two questions shape the answer: by which clock "since" is measured, and what the API counts.

- An event carries when it happened (`occurred_at`) and when it reached the API (`received_at`,
  the arrival at the function URL since ADR 0043). It may arrive up to 7 days after it happened
  (`MAX_OCCURRED_AT_AGE_MS`), for example when a phone comes back online.
- Several screens count the same kind with different marks: Overview, Visits, Devices and
  Acquisition all count visits, and opening one does not mean the admin saw the others.

## Decision

- `GET /v1/projects/{projectId}/arrivals?from&to&since` answers what was **received** after
  `since` and **happened** inside the range of days, by the same range predicate as every report.
  A screen's mark is the moment it was read, so a late event that happened in the period still
  counts as new; one that happened before the period does not count in it.
- The answer is the arrival times of each kind (visits, conversions, named events, failed
  requests), newest first, not a count per screen. The dashboard counts, for each screen, the
  times after that screen's mark; the API knows nothing of the screens. At most 100 times per kind,
  with `more` beyond them, so the dashboard shows "99+".
- Times are rounded up to the second. Rounding down could put an arrival a few milliseconds after
  a screen was read before that screen's mark and hide it; rounding up can count it twice, which
  is the error the dashboard accepts.
- `since` is clamped to the last 7 days, the same bound as late events, which keeps the query
  small; the dashboard starts a screen's mark over after 7 days anyway.
- `active_visits` counts the distinct visits with any event received in the last five minutes,
  whatever the range.
- A new index, `events_project_received_at_idx (project_id, received_at)`: every other index orders
  by `occurred_at`, and a query bounded by `received_at` would otherwise scan the project's week.
- The route has a throttler of its own, 30 asks a minute, keyed on the authenticated credential
  (the session, the access token or the connection), counted after authentication and the
  project's access check. Not by address: every dashboard read reaches the API from the
  dashboard's servers, so by address all its users would share one bucket. To register it safely,
  every route now derives its skip list from one list of throttlers, so a new throttler is skipped
  everywhere but where it is used, and the arrivals guard and the access-token guard each count
  only their own throttler (the route runs both).

## Consequences

- Every visible dashboard tab costs two cheap queries a minute (five index range scans and one
  count), and keeps Postgres awake while someone looks at the dashboard; the dashboard stops
  asking after 30 minutes without interaction.
- The answer holds only times and counts: no ids, names, paths or properties.
- The dashboard's mark is taken by the dashboard's server clock and `received_at` by the
  function's: a difference between them can count an item that is already on the screen. Counting
  twice is preferred to missing one.
- The MCP endpoint gets no tool for arrivals: an agent asks the reports.
