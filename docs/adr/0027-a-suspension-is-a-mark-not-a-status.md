# 27. A suspension is a mark on the account, not a status

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts),
[ADR 0017](0017-monthly-quota-measured-daily.md) (the monthly pause) and
[ADR 0018](0018-billing-follows-stripe-through-its-webhook.md) (billing).

## Context

The terms of the hosted plan let the operator suspend an account that abuses the service: forged
traffic, personal data sent in events, attacks, illegal use. A suspension stops the account's
projects from taking events and from being read in the dashboard, and is lifted once the problem
is fixed or the owner's objection is accepted. Until now that meant SQL by hand, and the only
switch that stopped ingestion was the quota pause, which the daily measurement rewrites.

`accounts.status` already carries the subscription: Stripe's webhook, the daily reconciliation,
`hasAccess` and the account lifecycle all read and write it. A suspension has nothing to do with
billing: a suspended account may be trialing, active or past due, and must stay so.

## Decision

1. **Two columns, `suspended_at` and `suspension_reason`**, set and cleared by the operator with
   `account:suspend --account <id> --reason "…"` and `account:resume --account <id>`. Writing the
   reason again keeps the moment of the first suspension. No new status.
2. **Ingestion asks the same cached question as the quota pause.** One query per project reads
   the pause and the mark together, cached for 60 seconds per instance; a suspended account's
   batches are answered `403 account_suspended` with the same CORS grant as `quota_exceeded`, so
   the tracker can read the answer and drop the batch instead of retrying.
3. **Every project-scoped dashboard read refuses it** (`ProjectAccessGuard`, so sessions and
   read-only tokens alike), and so do the owner's changes to projects, keys and people
   (`requireAccess`), with `403 account_suspended`.
4. **What stays open:** sign-in, the account in `GET /v1/me/accounts` (with `suspended_at` for
   everyone and the reason for the owner only), the billing portal, closing the account,
   exports, and the secret-key routes that erase or export a person's events. The owner can
   always cancel, get their data and contest; the people measured on the site keep their rights.
5. **No e-mail from the API.** The operator writes to the owner with the reason, what was
   suspended and how to contest, in their own words.

## Consequences

- The webhook, the reconciliation and the daily job never see a suspension, so lifting it brings
  the account back exactly as billing left it.
- A suspension takes effect, and is lifted, within a minute (the cache); the command says so.
- Retention keeps deleting events older than thirteen months during a suspension.
- Keys and tokens revoked while suspended stay revoked: resuming restores access, not secrets.
- The operator runs the commands from the command line with the owner's connection, like the
  other account scripts; there is no operator screen.
