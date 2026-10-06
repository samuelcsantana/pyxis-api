# 8. Answer dashboard queries from the raw events, without rollups

Date: 2026-10-06

## Status

Accepted

## Context

The dashboard asks for KPIs, daily series and rankings over any range of up to 400 days, in the
project's time zone, compared with the previous period. Pre-computed daily rollups would make
these reads cheap, but they need a job to build them, a table per shape, a backfill whenever a
definition changes, and care around time zones (a rollup by UTC day cannot answer a São Paulo
day). Pyxis serves a handful of small projects, and the events table already has an index on
`(project_id, occurred_at)`.

## Decision

- Every query reads `events` directly with SQL written through Drizzle's `sql` template, so every
  value is a bound parameter.
- Each definition (a visit, an identified user, a conversion, a write, a failed write) is one SQL
  fragment in `src/infra/queries/definitions.ts`, shared by every query.
- A range filters `occurred_at` between the local midnights of `from` and the day after `to`,
  computed once as `timestamptz` (`($from::date)::timestamp AT TIME ZONE $tz`), so the index
  serves every query and daylight saving time is handled by Postgres. Only the day bucket
  converts each row to local time.
- The use case validates the range in the project's zone, runs the independent reads in
  parallel, and fills days without events with zeros.
- Access to a project is checked once per request by a guard that answers the same 404 for a
  project that does not exist and one the admin was not granted.

## Consequences

- Measured locally on Postgres 18 with one million events of one project spread over 90 days
  (a 30-day range holds about 330,000 of them), best of three runs after a warm-up:

  | Query (30 days)                      | Time   |
  | ------------------------------------ | ------ |
  | Overview, all five reads in parallel | 498 ms |
  | Devices, four dimensions in parallel | 312 ms |
  | Acquisition, both reads in parallel  | 78 ms  |

  With the whole million in range, the overview takes 886 ms and devices 993 ms. The time goes to
  sorting the rows for the distinct counts (visits, identified users), not to finding them: the
  plan uses the index. A project with that many events a month is far beyond what Pyxis is built
  for today.

- If a project outgrows this, daily rollups per project and local day are the next step, and the
  definitions file already says what each one must count.
- No job, table or backfill exists for reads, and a change to a definition applies to the whole
  history at once.
