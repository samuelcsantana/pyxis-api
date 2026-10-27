# 49. Sign-up without a card

Date: 2026-10-27

## Status

Accepted. Builds on [ADR 0019](0019-sign-up-behind-a-switch-and-the-terms-version.md) (sign-up
behind a switch), [ADR 0023](0023-the-welcome-follows-the-subscription.md) (the welcome) and
[ADR 0048](0048-a-free-plan-is-a-status-with-its-own-limits.md) (the `free` status). Subscribing
from the free plan and falling back to it are later changes.

## Context

Until now a new owner signed up into an `incomplete` account and finished in Stripe Checkout; an
account that never subscribed was deleted after 7 days. With a free plan, a new owner should start
measuring at once, with no card. The plan has a cost ceiling, so it holds at most a set number of
accounts, and it must be possible to close it to new owners without a deploy. One person holds one
account at most, free or not.

## Decision

1. **Two settings.** `FREE_PLAN_OPEN` (default `false`) and `FREE_ACCOUNTS_MAX` (default 200),
   read by the HTTP function and the jobs function. The free plan takes new owners only while
   sign-up is open too, because the sign-up routes refuse otherwise.
2. **Completing sign-up claims a place.** With the switch on, the account is born `free` while the
   plan holds fewer accounts than the maximum. The count and the write run in one transaction
   under a Postgres advisory lock, so two sign-ups cannot both take the last place. At the cap,
   the account is born `incomplete` and marked `free_waitlisted_at`; its owner can subscribe in
   the meantime. With the switch off, sign-up is unchanged.
3. **An unfinished account takes a place too.** Every `incomplete` account never subscribed; its
   owner coming back with the plan open gets the free plan instead of being held out until the
   7-day cleanup. A returning owner with any other live account gets it back as it is. A partial
   unique index on `owner_admin_id` where the status is `free` backs "one free account per
   person" in the database.
4. **Waiting accounts are kept and opened.** A waiting account is kept 60 days from when it
   started waiting, not the 7 of an abandoned sign-up. The daily job opens the places left to the
   accounts that waited longest, under the same lock, skipping one that subscribed, is held or is
   suspended, and only while the switch is on.
5. **The welcome confirms the free plan.** A free account has no Checkout and no webhook, so it is
   welcomed at sign-up, best effort, after the terms acceptance is recorded; the daily job welcomes
   any free account still waiting, and it opens places before it welcomes, so the welcome is also
   the "a place opened" message. The welcome is one of three plans (trial, subscription, free);
   the free one gives the effective limits and the pause point.
6. **The answers say it.** `GET /v1/auth/sign-up` gains `free_plan` (`open`, `full`, `closed`),
   the verify answer gains `account_status`, and `GET /v1/me/accounts` gains `free_waitlisted_at`
   for the owner. All additive.

## Consequences

- Opening the free plan is a settings change and fresh containers, not a deploy. Closing it again
  stops new free accounts and the opening of waiting ones; accounts already free keep working.
- The dashboard must know the `free` status before the switch is turned on (it parses the status
  with a closed list).
- `GET /v1/auth/sign-up` counts the free accounts while the switch is on; with it off the route
  reads nothing from the database, as before.
- The 14-day trial still exists for an account that goes through Checkout. Removing it, and
  subscribing from a free account, are the next change.
