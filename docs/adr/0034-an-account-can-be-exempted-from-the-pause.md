# 34. An account can be exempted from the quota pause until a day

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0017](0017-monthly-quota-measured-daily.md) (the monthly quota, the
pause at 150%).

## Context

The first version of the terms said the service did not cut events. The pause at 150% of the plan
reduces a right, so for a customer who accepted that version it only applies from their next
renewal after a notice. The daily measurement paused every paid account the same way, and the
only way out was making the account free (`comped`), which also stops its billing.

## Decision

1. **A date on the account, `quota_pause_exempt_until`**, set by `account:exempt-quota` with a day
   (the start of that day, UTC) and cleared by the same command with `--clear`. Setting it also
   lifts a pause already in place.
2. **Before that moment the daily measurement does not pause the account.** Its events are still
   counted and shown; billing does not change.
3. **The owner is not told of a pause that will not happen**: the 80% and 100% notices go out
   without the sentence about a pause, and past 150% the owner gets the 100% notice if they have
   not had it, not the pause notice.
4. **The account shows the date** (`quota_pause_exempt_until` in `GET /v1/me/accounts`) to everyone
   in it, like the pause itself.

## Consequences

- When the day passes, the next measurement pauses the account if it is past 150%, and the pause
  e-mail goes out then.
- The exemption is a decision about one customer made by the operator, recorded with a date, not a
  plan or a status.
