# 10. Compare an unfinished day up to the same time of day

Date: 2026-10-07

## Status

Accepted. Refines the comparison of [ADR 0008](0008-dashboard-queries-on-raw-events.md).

## Context

The overview compares a range with the previous one: the same number of days right before it.
Its first answer was to read both as whole days. A range is allowed to end today, and today is not
over: at 10:00 in São Paulo, "today" holds ten hours, while "yesterday" holds all 24. With traffic
spread evenly over the day, a normal morning showed a drop of about 58 % against the day before.
The last 7 and 30 days carried the same bias, smaller: up to one seventh, and up to one thirtieth,
just after midnight. The dashboard painted that drop red, and the owner's first question, "how is
the product doing today?", got a wrong answer every morning.

## Decision

- When the last day of the requested range is today in the project's time zone, the previous
  period stops on its last day at the same local time of day as the request: today until 10:00
  against yesterday until 10:00; the last seven days against the seven before them, until 10:00 on
  the last of those.
- The cut is wall-clock time, not elapsed hours. A query scope carries it as a local time of day,
  and Postgres turns it into an instant with `($last_day::date + $time::time) AT TIME ZONE $tz`,
  the same way it turns the midnights, so the index on `(project_id, occurred_at)` keeps serving
  the read and daylight saving time stays Postgres's job.
- The current period is not cut: an event's `occurred_at` is never later than its arrival (the
  ingestion clamps it), so a range that ends today already ends at the time of the request.
- A range that ended before today still compares whole days.
- `GET /v1/projects/{projectId}/overview` says what it compared: `comparison_cutoff` is the local
  time (`HH:MM:SS.mmm`) the previous period stopped at, or `null` for whole days, and
  `previous_days` is the previous period's own daily series, every overview measure per day, so
  the dashboard can label the comparison and draw both periods. Both fields are additive.

## Consequences

- "Today" at 10:00 now reads as a flat day when traffic is flat. The label must say what is being
  compared ("vs. yesterday until 10:00"), which the API now makes possible.
- The overview runs six reads instead of five (the previous period's days). Measured locally on
  Postgres 18 with the same one million events as ADR 0008, best of five runs after a warm-up:

  | Overview, all reads in parallel | Before (five reads) | After (six reads) |
  | ------------------------------- | ------------------- | ----------------- |
  | 30 days                         | 542 ms              | 576 ms            |
  | 7 days                          | 123 ms              | 143 ms            |
  | Today                           | 16 ms               | 13 ms             |

- No other read compares periods; any later one that does goes through the same scope and gets the
  same rule.
- The cut is to the millisecond of the request, so two loads a minute apart compare slightly
  different windows. That is the honest answer for a period that is still running.
