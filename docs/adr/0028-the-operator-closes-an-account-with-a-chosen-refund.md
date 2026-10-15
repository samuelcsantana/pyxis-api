# 28. The operator closes an account with a chosen refund

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0025](0025-the-owner-closes-the-account-at-once.md) (the owner closes)
and [ADR 0027](0027-a-suspension-is-a-mark-not-a-status.md) (suspension).

## Context

The terms let the operator end the contract for serious or repeated abuse, or for a confirmed
repeated free trial. The refund then depends on the case: the unused part of the period, counted
from the start of a suspension when there was one; the whole first payment inside the seven-day
withdrawal period; or nothing, for a trial ended before any charge. Until now the only way was to
cancel in Stripe's dashboard, which left the keys valid until the daily job ran, and to refund by
hand.

## Decision

1. **`account:close --account <id> --reason "…" --refund full|prorata|none`**, from the operator's
   command line with the owner's connection and `STRIPE_SECRET_KEY`, like `account:link`.
2. **Same closure as the owner's.** It cancels the subscription at once when the account has one
   running, then reuses `AccountClosureRepository.close`: status `ended`, access ended now, every key
   revoked in the same transaction, deletion thirty days later.
3. **Refund modes, to the centavo,** on the latest paid invoice of the subscription:
   - `full`: everything that invoice paid;
   - `prorata`: what it paid × the whole days left of its line period (the current day counts as
     used) ÷ the days of the period, rounded down, counted from the start of a suspension when the
     account is suspended, otherwise from now;
   - `none`: nothing.
4. **The refund never blocks the closure.** If Stripe cannot cancel, nothing is closed. If the
   refund fails, the account is closed anyway, `accounts.refund_failed` is logged and the command
   tells the operator to refund by hand.
5. **The e-mail is the daily job's.** The closure leaves `ended_notified_at` empty, so the next
   daily run sends the end of access and the deletion date, as for any ended account. The reason
   is printed for the operator's own message to the owner; it is not stored.

## Consequences

- A suspended account closed later is refunded from the day it was suspended, as the terms say.
- The operator chooses the mode; the command does not decide which case applies.
- The command runs outside the functions, so its log lines reach the terminal, not CloudWatch:
  a failed refund is visible in the command's output only.
