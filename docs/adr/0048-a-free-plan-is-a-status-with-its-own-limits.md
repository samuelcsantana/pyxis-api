# 48. A free plan is a status with its own limits

Date: 2026-10-27

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts),
[ADR 0017](0017-monthly-quota-measured-daily.md) (the monthly quota) and
[ADR 0036](0036-a-larger-plan-is-limits-on-the-account.md) (limits on the account). Sign-up into
the free plan, subscribing from it and falling back to it are later changes.

## Context

The hosted service is going to offer a permanent free plan: 10,000 events a month, 1 project and
1 person (the owner alone), every feature, no card. Its measuring pauses as soon as the month
reaches the plan, instead of at 150% as the paid plan does, and comes back on the 1st. A free
account has access to its projects but no Stripe subscription, so nothing in billing describes it.

The account already has a status that decides access (`hasAccess`), whether there is a
subscription to cancel (`hasRunningSubscription`), who receives the notices sent to every owner,
and which accounts the daily job reconciles or welcomes. The limits come from one function,
`planLimitsOf`, with the operator's per-account columns on top.

## Decision

1. **`free` is a status**, not a column beside the status. It has access and no subscription. The
   status is what every reader already reads, and the plan, the access and the pause move
   together: an account cannot be "free" and "trialing" at once.
2. **The status chooses the base limits:** `FREE_PLAN_LIMITS` (10,000 / 1 / 1) for `free`,
   `HOSTED_PLAN_LIMITS` (100,000 / 3 / 3) for every other status. `comped` keeps the paid plan's
   limits: it is the paid plan given by the operator. The operator's columns still win over either
   base, so `account:limits` works on a free account too.
3. **The status chooses the pause ratio:** 1 on the free plan, 1.5 on the paid one. The
   threshold is rounded up to a whole number of events, the first count that reaches it, and the
   account answer gives it as `limits.pause_at_events`, so the dashboard never copies the ratio.
   The measurement's query does not change: the row it reads already carries the status and the
   account's own monthly limit.
4. **The notice levels stay ordinal.** A free account's 80% e-mail names the pause at 10,000, and
   at 10,000 the account goes straight to the paused level (150 in `notified_level`): there is no
   separate "100%, nothing is cut off" e-mail, because at 100% something is cut off.
5. **Free owners get the notices sent to every owner**, the 30-day notice of new terms included.

## Consequences

- The database check on `accounts.status` gains `free`: the deploy runs a migration.
- The dashboard parses the status as a closed list, so it must know `free` before the API can
  create a free account. This change creates none; the sign-up change that does is behind its own
  switch, and comes after the dashboard ships the status.
- The 80% and pause e-mails still describe the paid plan's 150%; their free-plan text comes with
  the sign-up changes, before any free account exists.
