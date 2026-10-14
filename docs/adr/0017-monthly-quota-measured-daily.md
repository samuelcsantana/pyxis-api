# 17. Measure each account's month once a day; pause ingestion at 150% of the plan

Date: 2026-10-14

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts own projects).

## Context

The hosted plan includes 100,000 events a month per account. Two things had to be true: an
account that goes a little over keeps every event (a launch day, a post that spread), and one
account cannot keep the shared database busy for everyone else indefinitely. Counting every batch
against a live counter would add a write to the hot path of ingestion, which today only reads
the project (from a 60-second cache) and inserts the events.

## Decision

- **Measured once a day.** The daily job counts each account's events for the current calendar
  month in UTC, across its projects (the same month `usage:report` uses), and keeps the figure in
  `account_usage_months` with the time it was measured. Projects without an account are never
  counted.
- **Paused at 150%.** An account (other than a free, `comped` one) whose month reaches 150% of the
  plan is paused until the first instant of the next month: `accounts.ingestion_paused_until`.
  Between 100% and 150% nothing is cut off; the account is told (a later change sends the e-mails
  at 80% and 100%).
- **Ingestion reads the pause, never writes it.** After the key, the origin and the rate limit, a
  batch for a paused project is answered `403 quota_exceeded` with the CORS grant of its origin,
  so the tracker reads the status and drops the batch instead of retrying it. The pause is cached
  per project for 60 seconds, like the key.
- **A failed measurement fails the daily run**, after retention and before the icons, so the
  schedule runs it again; nobody is paused or released on a stale figure.

## Consequences

- An account can go past 150% for up to a day before the pause starts; the database's compute
  ceiling bounds the cost of that day.
- The pause lifts by itself when the month turns, with no job: the stored date simply passes.
- The figure shown to the owner is as of the last daily run, with the time it was measured.
