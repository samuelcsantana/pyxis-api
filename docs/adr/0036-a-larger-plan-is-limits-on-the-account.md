# 36. A larger plan is limits on the account, set by the operator

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts and the hosted plan's
limits) and [ADR 0017](0017-monthly-quota-measured-daily.md) (the monthly quota).

## Context

The hosted plan had one set of limits for every account: 100,000 events a month, 3 projects and
3 people. The home page now asks whoever needs more to write in, and the terms allow a plan or a
price fitted to the volume, agreed by e-mail. Nothing in the service could hold a larger plan.

## Decision

1. **Three nullable columns on the account**: `events_per_month_limit`, `projects_limit` and
   `people_limit`. Null means the hosted plan's value, so every existing account keeps its plan
   without a data change.
2. **One function gives an account's effective limits** (its own value, or the hosted plan's),
   and every place that reads a limit uses it: the daily measurement and its notices (80%, 100%,
   and the pause at 150% of the account's own monthly limit), creating a project, adding a person,
   and `GET /v1/me/accounts`. The pause exemption keeps working on top of it.
3. **The operator sets them** with `account:limits`, giving any of `--events`, `--projects` and
   `--people`, and goes back to the hosted plan with `--reset`. The command prints the effective
   limits and anything already over them.
4. **Lowering a limit deletes nothing.** An account over a lowered limit keeps its projects and
   people, cannot add more until it is under, and is measured against the new monthly limit from
   the next daily run.
5. **The price is not here.** A larger plan's price is a Stripe price created for that customer;
   the subscription is linked to the account with `account:link`, as for an account made on
   request.

## Consequences

- A larger plan is two commands, with no deploy; there is no self-service upgrade, which fits a
  plan sold by e-mail.
- Limits are per account, not per subscription: changing the subscription in Stripe does not
  change them, and the operator resets them when a larger plan ends.
- The maxima the command accepts (100 million events, 100 projects, 100 people) are named
  constants, so a typo cannot open an account to an unbounded load.
