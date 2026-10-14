# 18. Billing follows Stripe through its webhook, re-reading the subscription

Date: 2026-10-14

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts) and
[ADR 0017](0017-monthly-quota-measured-daily.md) (the quota).

## Context

The hosted plan is paid through Stripe: Checkout starts a subscription with a 14-day trial, and
Stripe charges, retries failed payments and cancels on its own. The API needs each account's
status to follow (trialing, active, past due, ending, ended) without polling Stripe on every
request. Stripe delivers its webhook events at least once, out of order, and sometimes days late.

## Decision

- **One route takes Stripe's events:** `POST /v1/billing/stripe/webhook`, with the raw body kept so
  the signature can be checked against the endpoint secret. Only this route accepts bodies larger
  than the 32 KB of a batch (512 KB); it sits outside the rate limits and the OpenAPI document.
- **Events carry ids, never state.** Each event is reduced to its subscription, customer and account
  ids, and the subscription is read again from Stripe before anything changes, so an old or
  repeated event can only write the current state.
- **Each event is applied once.** `billing_events` keeps every event id; an event is claimed when it
  arrives and completed after it is applied. One that fails half way (Stripe unreachable) stays
  claimed but not completed, is answered 503, and Stripe's retry applies it.
- **The account is found by the account id the Checkout carried**, then by the subscription or the
  customer id it already holds. A subscription no account owns is logged and ignored.
- **The status mapping lives in the domain:** trialing and active stay so unless they will not renew
  (then `ending`, with access until the trial or the paid period ends); past due stays past due;
  canceled, unpaid, expired and paused are `ended`, with access ending when that was first seen.
- **Subscriptions paid before sign-up existed** (payment links) are tied to an account by hand with
  `account:link`.

## Consequences

- Nothing in the API calls Stripe while serving the dashboard; Stripe is read only on its events,
  at Checkout and at the portal.
- Missing an event is not fatal: the next event about the same subscription brings the account up to
  date, and a daily reconciliation can read the subscriptions of every account.
