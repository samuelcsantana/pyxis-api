# 52. Free accounts with no events are deleted after a notice

Date: 2026-10-27

## Status

Accepted. Builds on [ADR 0048](0048-a-free-plan-is-a-status-with-its-own-limits.md) (the `free`
status), [ADR 0051](0051-an-ended-subscription-falls-back-to-the-free-plan.md) (falling back to
free), [ADR 0029](0029-a-deletion-can-be-held.md) and
[ADR 0033](0033-a-hold-keeps-everything-it-covers.md) (deletion holds), and
[ADR 0017](0017-monthly-quota-measured-daily.md) (nothing is written on the ingestion path).

## Context

The free plan has no payment to end it, so an account nobody uses would be kept, with its
projects and keys, for as long as the service runs. The terms that bring the free plan (1.3,
Clause 7.6) say that a free account that stores no event in the 30 days after it starts, or none
for 90 days in a row, is deleted if it still has none seven days after an e-mail notice. Paid
accounts are never deleted for having no events.

The deletion is decided by a routine and takes the service away from its owner, so the owner
must be told the criterion and the date, and be able to ask a person to review it (LGPD, art.
20). A paid account that falls back to free after a quiet period must not lose its data seven
days later when, as a paid account, it would have had thirty.

## Decision

1. **Two cases, counted from the day the account entered the free plan.** `empty`: no event
   stored in the 30 days after `free_since`. `idle`: no event stored for 90 days counted from the
   later of the last stored event and `free_since`. Every door into the free plan sets
   `free_since` (sign-up, a waiting account opened, a withdrawal, a fallback); subscribing
   clears it. Counting from `free_since` rather than from the account's creation is more
   favorable than the clause's letter, and is what keeps a fallen-back account from being
   deleted at once.
2. **Stored events only.** Batches refused at the edge (robots, data centers, the quota pause) do
   not count. The last stored event of an account is the latest of one backward read of
   `events_project_received_at_idx` per project, in the daily job; ingestion writes nothing for
   it.
3. **Notice, then seven days.** The daily lifecycle, after removing stale unfinished accounts,
   sends the `empty_free_account` or `idle_free_account` notice with the deletion day and marks
   `inactivity_notified_at`; a failed e-mail leaves the account unmarked for the next day. An
   event stored after the notice clears the mark. Seven days after the notice, an account still
   without events is deleted by the same path as an ended account: its projects (except those
   under a hold), the account, the people left with nothing, and an `account_deleted` e-mail.
4. **What stops it.** Only free accounts are candidates. A deletion hold and a suspension keep
   the account out of the sweep entirely: a suspended account refuses events, so it would look
   idle by construction. The notice says that replying asks a person to review the deletion; the
   operator answers by holding the deletion (`account:hold`) while the case is looked at.

## Consequences

- An account the operator suspended for more than 90 days is notified the day the suspension is
  lifted and can be deleted seven days later, because nothing records when a suspension ended.
- The days a free account spends paused at its quota count toward the 90: the pause only follows
  events stored that same month, so at most one month of it can.
- A reply asking for review protects the account only once the operator holds its deletion; one
  that arrives on the last day needs that hold before the next daily run.
- The deletion uses the existing path, so its batches, partial holds and failures are reported
  with the rest of the lifecycle.
