# 26. Repeated free trials are detected and reported, never blocked

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0018](0018-billing-follows-stripe-through-its-webhook.md) (billing) and
[ADR 0019](0019-sign-up-behind-a-switch-and-the-terms-version.md) (sign-up with a trial).

## Context

The hosted plan starts with a 14-day free trial, with a card required at Checkout. Nothing stops
someone from closing the account before the trial ends and signing up again with another e-mail
address and the same card, over and over. The card is only known after Checkout, and the
Checkout page has already promised the trial by then: taking the trial away at that point, or
charging before day 15, would be a charge the customer was not told about.

Stripe gives every card a fingerprint, derived from the card number and the same for every
payment method made from that card within the Stripe account. The API never sees the number.

## Decision

1. **Read the fingerprint with the subscription.** The webhook already re-reads the subscription
   for every event; it now expands its default payment method and keeps the card's fingerprint.
2. **Record each card that starts a trial**, once per account, in `trial_cards` (fingerprint,
   account id, the date it was first seen), with no foreign key to `accounts`.
3. **Report a repeat.** When a card is recorded for an account and other accounts already used it
   for a trial, the API logs `billing.repeated_trial` with the account id and the earlier account
   ids (never the fingerprint), and the alarm `pyxis-api-repeated-trials` e-mails the operator.
4. **Do nothing else automatically.** No cancellation, no early charge. The operator looks the
   accounts up and decides by hand, under the abuse clauses of the terms.
5. **Keep a record for twelve months** after the trial started, then the daily retention job
   deletes it, whether or not its account still exists.
6. **Best effort.** A failure to record or compare is logged
   (`billing.repeated_trial_check_failed`) and the billing event is applied anyway.

## Consequences

- The rows outlive their account on purpose: an account closed and deleted after thirty days
  would otherwise erase the only trace of its trial, and the next sign-up with the same card
  would look new. Twelve months bounds how long a card is remembered; the privacy policy names
  the data, the purpose (preventing abuse of the free trial) and the period.
- The restricted Stripe key needs read access to PaymentMethods for the expansion.
- A card used again in the same account (a new subscription after a cancellation) is not a
  repeat, and a second alert for the same account and card is never sent.
- Detection depends on the same card: another card from the same person is not caught. At the
  plan's scale that is accepted; the alternative (identity checks) costs more than it saves.
