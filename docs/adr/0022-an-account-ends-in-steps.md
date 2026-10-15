# 22. An account ends in steps, each done once by the daily job

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0018](0018-billing-follows-stripe-through-its-webhook.md) (billing) and
[ADR 0021](0021-people-are-counted-across-the-account.md) (people).

## Context

The terms promise that when a subscription ends, the sites stop being measured, the reports stay
readable for thirty days, the owner is warned before anything is deleted, and then everything
goes. Stripe tells the API when a subscription ends, but a webhook can be missed, and nothing in
Stripe deletes Pyxis data. Sign-ups that never reach Checkout also leave accounts behind.

## Decision

The daily job runs the account lifecycle after measuring the accounts:

1. **Reconcile.** Every account with a Stripe subscription and a status with access is compared
   with its subscription read from Stripe and updated; a missed webhook cannot leave an account
   running. A failure is logged for that account and the rest go on.
2. **Revoke at the end of access.** Once an ended account's access date has passed, every live key
   of its projects is revoked, so its sites stop sending events. This bypasses the dashboard's
   "keep the last public key" rule, which protects owners from themselves, not the system.
3. **Tell the owner,** once, that the subscription ended and on which day the data is deleted.
4. **Remind them** once in the last seven days.
5. **Delete thirty days after the end of access:** each project's events in batches of 5,000 (as
   retention does, so one large project never becomes one long statement), then the project with
   its keys, access and icons, then the account, then confirm by e-mail.
6. **Remove abandoned sign-ups:** accounts still `incomplete`, never subscribed and without
   projects, seven days after they were created.

Each step is recorded on the account (`keys_revoked_at`, `ended_notified_at`,
`deletion_reminded_at`), so it happens once; a failed e-mail is not recorded and is tried again
the next day. The deletion date is computed from `access_ends_at`, never stored. Any billing
update that gives the account access again clears the three marks, so an account that comes back
and ends again goes through every step again; its keys stay revoked, and the owner creates a new
public key.

**People removed with an account** are only those of that account (its owner and the admins with
access to its projects) who are left with no project and no account. Nobody else is ever deleted
by this job.

## Consequences

- Each account is handled on its own: one that fails does not stop the others, and the run fails
  at the end, so the error alarm fires and the next day picks it up where it stopped.
- The jobs function needs its own copy of the Stripe key (`/pyxis-api/jobs/STRIPE_SECRET_KEY`).
- Reconciliation reads one subscription per running account per day, well within Stripe's limits
  at the plan's scale.
