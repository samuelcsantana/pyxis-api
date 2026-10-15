# 33. A hold keeps everything it covers, a single project included

Date: 2026-10-15

## Status

Accepted. Amends [ADR 0029](0029-a-deletion-can-be-held.md) (a deletion can be held).

## Context

A hold exists for a dispute or for a law, a court order or an authority that asks to preserve
data. ADR 0029 held only the deletion of a whole account and let the thirteen-month retention go
on, so events reached by an order could still be deleted by the daily job a few weeks later. The
terms also promise to preserve only the data an order reaches, which may be one site of an account
with several.

## Decision

1. **A project can be held on its own**: `projects.deletion_held_at` and `deletion_hold_reason`,
   set by `project:hold` with the project's id and the reason, cleared by `project:release`.
   Writing the reason again keeps the moment of the first hold.
2. **A held project cannot be deleted by its owner** (`409 deletion_on_hold`, the account's code).
3. **The deletion of its account keeps it.** Thirty days after the end of access, the daily job
   deletes the account's other projects and keeps the held one and the account, which owns it;
   nobody is e-mailed, `accounts.deletion_partly_held` is logged and `partlyHeld` counted. The first
   run after `project:release` finishes the deletion and sends the e-mail.
4. **A hold stops the retention too**, for a held project and for every project of a held account:
   preserving data means not deleting any of it, whatever the job.
5. **The settings show the hold** (`deletion_held_at`) to whoever reads the project, never the
   reason, which may be an order the operator cannot disclose.

## Consequences

- Events of a held project can be kept past thirteen months, as the processing agreement allows
  when a law or an order requires it.
- The erasure of a person's events, asked by the customer with the secret key, still goes on under
  a hold; whether an order should stop it is left to a lawyer.
- The operator can still delete a project from the command line, after releasing the hold if that
  is the intent.
