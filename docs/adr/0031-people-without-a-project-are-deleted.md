# 31. People left without a project are deleted after thirty days

Date: 2026-10-15

## Status

Accepted. Extends [ADR 0022](0022-an-account-ends-in-steps.md) (an account ends in steps).

## Context

The privacy policy promises that a person left without access to any project is deleted within
thirty days. The daily job only removed the people of an account it deleted: someone taken off
their last project by its owner or by `admin:revoke`, or whose only project was deleted, stayed in
`admin_users` with their e-mail address, sessions and tokens for as long as the database lived.

## Decision

1. **A mark, `admin_users.projectless_since`**, written by the daily job the first time it finds a
   person with no row in `admin_project_access` and no account of their own. The thirty days count
   from that mark, so they start on the first run after the person was left alone, never earlier.
2. **The mark goes away by itself**: a person who gets a project or an account back loses it on the
   next run, and the count starts over if they are left alone again.
3. **Thirty days after the mark, the person is deleted** if they are still alone. Their sessions,
   tokens and digest records go with them by cascade, and an export they once asked for loses the
   link to them. The same condition is checked in the `DELETE`, so a person invited again on the
   last day is kept.
4. **No exception**, not even for a person the operator suspended: the policy promises none, and a
   suspended person with no project has nothing left to reach.
5. **Part of the account lifecycle run**, after the deletion of ended accounts, with its counts in
   `accounts.lifecycle_done` (`projectlessMarked`, `projectlessRemoved`).

## Consequences

- People already alone on the day this ships are marked on the first run and deleted thirty days
  later.
- Inviting a deleted person again creates a new record; nothing of the old one is left to join.
- The sweep never looks at who did what: it is the same rule for everyone, with no decision about
  a person.
