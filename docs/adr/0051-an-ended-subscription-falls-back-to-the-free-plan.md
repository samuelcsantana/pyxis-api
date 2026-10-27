# 51. An ended subscription falls back to the free plan

Date: 2026-10-27

## Status

Accepted. Builds on [ADR 0048](0048-a-free-plan-is-a-status-with-its-own-limits.md) (the `free`
status), [ADR 0050](0050-subscribing-from-the-free-plan-and-withdrawing-back-to-it.md)
(withdrawing back to free), [ADR 0018](0018-billing-follows-stripe-through-its-webhook.md)
(billing follows Stripe through its webhook), [ADR 0025](0025-the-owner-closes-the-account-at-once.md)
and [ADR 0028](0028-the-operator-closes-an-account-with-a-chosen-refund.md) (closing an account).

## Context

Until the free plan, a subscription that ended (cancelled at the end of its period, or unpaid
after Stripe gave up) ended the account: its keys were revoked and its data deleted 30 days
later. With a free plan of one project and one person, an account that already fits it loses
nothing by staying, and deleting it would cost the customer their history for leaving a plan,
not the service.

Three things complicate the move:

- The terms with the free plan (1.3) bind an account created before them only from a date
  announced at least 30 days ahead. Until then that account's subscription must end as the
  earlier terms say.
- An owner may close the account while Stripe is cancelling its subscription; the webhook that
  follows must not reopen it on the free plan, nor e-mail the owner that it did.
- A withdrawal (ADR 0050) puts an account back on free at once, even when it holds more than the
  free plan allows, because the right to withdraw cannot depend on deleting a project first.

## Decision

1. **One rule, two doors.** The webhook and the daily reconcile both compute the update from
   Stripe as before and, when it ends a subscription that was running, ask one pure rule,
   `fallsBackToFree`: the free plan is open (`FREE_PLAN_OPEN`), the owner is bound by terms with
   the free plan, the owner has no other free account, and the account's projects and people fit
   the free plan's limits (the account's own limits when the operator set them). The month's
   events never keep an account out; the next daily measure pauses one that is over 10,000.
2. **Bound by the terms.** An owner is bound once they accepted version 1.3 or later at sign-up,
   or once `FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM` has passed. Unset, no earlier account is
   bound. A version that is not a plain `major.minor` never binds.
3. **The cap does not apply.** A customer leaving is never put on the waiting list of the free
   plan; only the switch closes this door.
4. **One conditional write.** The move to `free` updates the account only while it still runs a
   subscription. It keeps the Stripe customer, clears the subscription, its dates and the
   end-of-access marks, keeps the keys, and marks `back_to_free_notice_due_at`. An account closed
   meanwhile is not running, so it stays ended and is not e-mailed. Closing clears the mark too.
5. **The owner is told.** The `back_to_free` e-mail replaces `access_ended` for that account:
   the subscription ended, the sites keep sending events, the monthly events of the free plan
   and its pause, how to subscribe again or close. The webhook sends it as best effort; the daily
   job sends any still due.
6. **A withdrawal over the limits gets 30 days.** The withdrawal marks `free_plan_fit_due_at` 30
   days ahead when the account does not fit, answers it as `fit_by` and names the day in its
   e-mail. On that day the daily job, before it revokes the keys of ended accounts, ends the
   account if it still does not fit, so it follows the ordinary end of access and deletion; one
   that fits loses the mark.

## Consequences

- An account that falls back keeps its keys and data with the free plan's limits, and becomes
  subject to the free plan's own rules, such as the deletion of inactive free accounts.
- The dashboard can show what to remove before cancelling: `GET /v1/me/accounts` answers the
  owner the account's `project_count`, `people_count` and `free_plan_fit_due_at`.
- The date for earlier accounts is a deployment setting, set the day the notice of the new terms
  is sent; until it is set, earlier customers end as before even with the free plan open.
- A withdrawal still ignores which terms bind the owner: putting an account back on free is more
  favorable than closing it, and it is the customer's choice.
