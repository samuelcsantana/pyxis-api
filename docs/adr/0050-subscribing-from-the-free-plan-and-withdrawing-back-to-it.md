# 50. Subscribing from the free plan, and withdrawing back to it

Date: 2026-10-27

## Status

Accepted. Builds on [ADR 0048](0048-a-free-plan-is-a-status-with-its-own-limits.md) (the `free`
status), [ADR 0049](0049-sign-up-without-a-card.md) (sign-up without a card),
[ADR 0017](0017-monthly-quota-measured-daily.md) (the monthly quota) and
[ADR 0025](0025-the-owner-closes-the-account-at-once.md) (closing with a refund). Falling back
to the free plan on cancelling is a later change.

## Context

A free account must be able to subscribe to the paid plan, and the terms that bring the free
plan have no 14-day trial. A free account already has access, so the webhook's "first access"
welcome never confirms that subscription. A free account paused at its 10,000 events must start
measuring again as soon as it pays. And the consumer's right to withdraw within 7 days (CDC, art.
49; Decreto 7.962/2013, art. 5) used to be exercised only by closing the whole account, which, for
someone who was on the free plan before paying, costs the free account to undo the payment.

## Decision

1. **Checkout from free, never with a trial.** A free account opens Checkout like an unfinished
   one, with no trial and coming back to `/account` if left. The trial for an unfinished sign-up
   follows its own setting, `TRIAL_OFFERED`, turned off the day the terms without a trial take
   effect; it does not follow `FREE_PLAN_OPEN`, so turning the free plan off again does not bring
   the trial back.
2. **Free to paid lifts the pause at once.** When the webhook moves a free account to a running
   subscription, the same write clears `ingestion_paused_until` and resets the month's notice
   level (a stored "paused" level would have silenced the paid plan's notices until the month
   turned). The projects see it within the 60 seconds of the account state cache.
3. **A free account keeps the free plan on a subscription without access.** A subscription that
   never ran, or one cancelled, leaves a free account free: the event is completed and nothing is
   written. This is also how the cancellation that follows a withdrawal reaches the webhook.
4. **The subscription is confirmed by e-mail.** The free-to-paid move sets
   `subscription_confirmation_due_at`; the webhook sends the confirmation (plan, interval, the
   7-day withdrawal and its full refund, the terms accepted), best effort, and the daily job sends
   any still due. The mark is set only by that move, so no earlier customer is e-mailed.
5. **Withdrawal goes back to the free plan.** `POST /v1/accounts/{accountId}/withdraw`, owner
   only, while the free plan is open, within 7 days of the subscription's first payment, read
   from Stripe before anything changes. It cancels the subscription at once, refunds that payment
   (best effort, with a refund by hand on failure, as when closing), puts the account back on
   `free` keeping its Stripe customer, and confirms by e-mail. Closing the account stays the way
   to leave the service, and the way to withdraw while the free plan is closed.

## Consequences

- An account over the free plan's limits that withdraws is put back on the free plan with
  nothing deleted; telling it what to remove comes with the fallback to free on cancelling.
- A customer from before the free plan whose first payment is less than 7 days old when the plan
  opens can also withdraw to the free plan: more favorable than closing.
- The dashboard needs a withdraw button on Account, shown within the window and while the free
  plan is open; the API answers `409 withdrawal_window_closed` after it.
