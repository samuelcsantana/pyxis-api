# 29. A deletion can be held

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0022](0022-an-account-ends-in-steps.md) (an account ends in steps) and
[ADR 0027](0027-a-suspension-is-a-mark-not-a-status.md) (marks on the account).

## Context

An ended account is deleted thirty days after its access ended, by the daily job, with no
exception. The terms promise exceptions: data needed for a dispute, kept while a contested
measure is examined, or that a law, a court order or an authority asks to preserve, and an export
the owner is owed after a suspension. Keeping such data meant editing the database by hand before
the job ran.

## Decision

1. **Two columns, `deletion_held_at` and `deletion_hold_reason`**, set and cleared by the operator
   with `account:hold --account <id> --reason "…"` and `account:release --account <id>`. Writing the
   reason again keeps the moment of the first hold. Like a suspension, a mark, not a status.
2. **The daily job leaves a held account alone:** no deletion reminder, no deletion, and an
   abandoned sign-up that is held is not removed either.
3. **The owner cannot delete a project of a held account** (`409 deletion_on_hold`), so a hold
   also keeps what the owner could otherwise erase from the dashboard.
4. **The owner sees that the deletion is held** (`deletion_held_at` in `GET /v1/me/accounts`), but
   not the reason, which may be a legal order the operator cannot disclose.
5. **Nothing else stops.** Events older than thirteen months are still deleted by retention, the
   people measured on the site can still have their events erased, and the operator can still
   delete a project from the command line, after releasing the hold if that is the intent.

## Consequences

- Releasing a hold on an account ended more than thirty days ago lets the next daily run delete it
  at once; the command says so.
- A hold covers the account and its projects together; there is no hold for a single project.
- The terms' promise to postpone a deletion is now something the service does, not a manual step.
