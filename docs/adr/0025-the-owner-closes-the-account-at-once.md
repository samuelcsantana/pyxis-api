# 25. The owner closes the account at once, with a refund inside seven days

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0018](0018-billing-follows-stripe-through-its-webhook.md) (billing) and
[ADR 0022](0022-an-account-ends-in-steps.md) (the end of an account).

## Context

An owner who wants to leave could cancel in Stripe's billing portal, but that keeps access until
the end of the period paid and leaves the data for thirty days after it. Someone who wants to go
now has to write to support. The terms also give every customer a full refund when they give up
within seven days of the first charge, and the operator would otherwise refund it by hand.

## Decision

`POST /v1/accounts/{accountId}/close`, for the owner only, with the owner's e-mail address typed
again (`409 confirmation_mismatch` otherwise; `409 account_ended` for an account already ended):

1. **Cancel the subscription at once** when the account has one running (trialing, active, past
   due or ending). If Stripe refuses, nothing is closed and the answer is `503`, so the owner can
   try again.
2. **Refund the first payment** of the subscription in full when it was made in the last seven
   days, through the payment intents of its first paid invoice. A refund that fails is logged
   (`accounts.refund_failed`) for a refund by hand and does not stop the closure, which the owner
   has already asked for and Stripe has already applied.
3. **End the account now:** status `ended`, access ending now and every live key of its projects
   revoked, in one transaction, with `keys_revoked_at` set so the daily job does not revoke again.
4. **Tell the owner** the date everything is deleted (thirty days from now) and mark the notice
   sent; a failed e-mail is left to the daily job, as in ADR 0022.

The rest is ADR 0022: the reminder in the last seven days and the deletion thirty days after the
end of access. The webhook that Stripe sends for the cancellation keeps the end date already
stored, so an account closed by its owner is never given back the rest of its period.

## Consequences

- The restricted Stripe key needs write access to Subscriptions and Refunds and read access to
  Invoices.
- Outside the seven days there is no partial refund, as the terms say; the dashboard has to say
  so before the owner confirms.
- Exports keep working for an ended account, so the thirty days are also the time to take a copy.
