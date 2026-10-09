# 11. Send a weekly digest by e-mail from the jobs function

Date: 2026-10-09

## Status

Accepted. Builds on [ADR 0008](0008-dashboard-queries-on-raw-events.md) (the queries it reads) and
[ADR 0007](0007-email-code-sign-in-with-opaque-sessions.md) (the e-mail it shares a layout with).

## Context

The dashboard answers questions only when someone opens it. A broken install, a deploy that stops
the tracker or a route that starts failing goes unnoticed until then. Real-time views and threshold
alerts would catch it sooner, but a live view keeps the free Postgres compute awake, and nobody
knows yet which thresholds matter. A weekly e-mail costs one run a week, and its numbers show which
figures are worth an alert later.

## Decision

- **What:** every Monday, each admin receives, for each project they keep it on for, the week that
  closed on Sunday in the project's time zone, compared with the week before. It shows visits,
  identified users, converting visits and failed writes, the visits of each day, the top five pages
  and named events, the three write routes with the most failures, and a link to the same week in
  the dashboard. A week without visits still sends, starting with when the last event arrived.
- **When:** one EventBridge schedule at 11:00 UTC (08:00 in Brasília) invokes the existing jobs
  function with `{"job":"weekly-digest"}`. Each project's week is the Monday-to-Sunday that has
  ended where the project is, so a project still on Sunday gets the week before, never an
  unfinished one. Any other event keeps running the daily retention, so the daily schedule is
  untouched.
- **Numbers:** the digest reads the same queries as the dashboard's Overview and Requests screens,
  so an e-mail and the screen agree for the same range. No new SQL, no rollups.
- **Once per week:** `digest_deliveries` keeps one row per project, admin and week, written only
  after Resend accepted the e-mail. A retried or manual run sends only what is missing. Each admin
  is served on their own: a failed e-mail is logged and the run moves on.
- **Who and how to stop:** the switch lives on `admin_project_access.weekly_digest`, on by default,
  per admin and project, and is changed from the dashboard's Settings while signed in. There is no
  one-click unsubscribe link: it would need a signing secret and a public page, for a handful of
  admins who already sign in.
- **Language:** the one of the admin's last sign-in, kept on the sign-in code and copied to the
  admin only when that code is verified, so knowing an admin's address does not let anyone change
  it.

## Consequences

- The digest carries aggregates, paths, event names and routes only: no user id, no visit link. Its
  logs carry project and admin ids, never an address.
- The jobs function needs the Resend key: `/jobs/RESEND_API_KEY` holds the same value as the API's,
  so rotating the key means updating both parameters.
- One Monday run wakes the database once more a week, and the Resend free tier (3,000 e-mails a
  month) covers about 700 admin-project pairs.
- Admins are served one after the other. That stays under Resend's request rate. With many admins
  it would take longer, still far below the function's 15 minutes.
- Alerts (an error-rate spike, no events for a day) can reuse the schedule, the delivery table and
  the e-mail layout, once the digests show which numbers matter.
