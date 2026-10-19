# 41. A demo project is filled with invented visits every day

Date: 2026-10-19

## Status

Accepted. Serves [ADR 0040](0040-a-directory-reviewer-signs-in-with-a-code-the-operator-opens.md)
(the reviewer code) and follows [ADR 0016](0016-accounts-own-projects.md) (a project without an
account is the operator's).

## Context

A connector directory's reviewers test every tool against a populated account, and they may
come back weeks later without notice. Every Pyxis tool reads a range that ends today: a project
seeded once would answer "nothing in this period" a month later, which looks like a broken
connector. Showing a real project instead would hand a stranger someone's real numbers.

The dashboard's live demo invents its data on the dashboard's server, shaped as answers to the
screens; the API and its tools read rows, so the reviewer's project needs rows.

## Decision

1. **A project is marked, not configured**: `projects.demo_traffic` (migration 0030), set and
   cleared with `project:demo-traffic --project <id> [--off]`. Only a project without an account
   can be marked, so invented events never sit next to a customer's real ones.
2. **The daily job fills it**, after its other steps: for each marked project, every day from
   the day of its latest event to today, up to the moment the job runs. A project without
   events, or one whose job stopped for longer, starts 90 days back. The day of the latest
   event is drawn again, so the rest of yesterday arrives with today.
3. **Each day is drawn from a PRNG seeded by the project and the day.** The same day always
   gives the same events with the same ids, and events are keyed by `(project_id, id)`, so a
   run never adds a day twice and there is no state to keep beyond the events themselves.
4. **The events are shaped as ingestion would have stored them**: templated paths, the source
   and its channel (`classifyChannel`) only on a visit's first page view, `api_request` with
   method, route, status, duration and error code, version 4 UUIDs, one device and one place per
   visit, people from a list seeded by the project alone so a person's timeline spans days.
   The store converts with `signup_completed`, which the project's conversion event should be.
5. **25 to 62 visits a day**, by weekday, about 260 events: enough for every screen and tool,
   small against the database's size (about 11 MB of 1 GB on 2026-10-19).
6. **Best effort**: a failure is logged as `jobs.demo_traffic_failed`, the outcome reports
   `demoTraffic: null`, and every other job has already run.

## Consequences

- No alarm watches `jobs.demo_traffic_failed` yet: a failure shows as a project whose latest
  event stops moving, in the daily outcome and in the dashboard. Adding a metric filter is a
  later Terraform change.
- "Today" in the project holds only what happened before the job ran (06:00 UTC); ranges that
  end yesterday or earlier are always complete.
- Unmarking keeps the events already added; the retention, or `project:delete`, removes them.
- Retention keeps the project to 13 months, about 100,000 events at this volume.
