# 40. A directory reviewer signs in with a code the operator opens

Date: 2026-10-19

## Status

Accepted. Builds on [ADR 0007](0007-email-code-sign-in-with-opaque-sessions.md) (sign-in with
an e-mailed code) and [ADR 0037](0037-the-api-is-its-own-oauth-server-for-claude.md) (the OAuth
server for Claude).

## Context

Anthropic's connector directory lists remote MCP servers that people add to Claude without
typing an address. A submission must give reviewers credentials for an account with data, and
reviewers may test the connector again later, unannounced, while the listing exists. Connecting
Claude to Pyxis passes through the dashboard's consent page, and the dashboard signs in only with
a six-digit code sent by e-mail: a reviewer cannot read the inbox of a test address.

A password for one account would be a second way of signing in, with its own storage, reset and
attack surface, used by nobody else. Keeping the code in the deployment's configuration would
still need the database to count wrong guesses, since every Lambda instance is short-lived, and
rotating it would need a deploy.

## Decision

1. **A reviewer code belongs to one admin**, in `reviewer_codes` (one row per admin, deleted with
   the admin), stored only as its SHA-256 hash. It is six digits from the same generator as the
   e-mailed codes, so the dashboard's code cells take it and the dashboard does not change.
2. **The operator opens and closes it**: `reviewer:open --email <address> [--days <n>]` prints
   the code once and replaces any code the admin had; `reviewer:close` deletes it. The admin must
   exist already (`admin:grant` gives them the project the reviewer reads).
3. **It lasts a year by default, 365 days at most**, because a listing can be tested at any time
   while it exists; closing it is a deliberate act, not a timer that runs out during a review.
4. **While it is open, the address is e-mailed no code.** `request-code` creates and sends
   nothing and answers the same 202 as always; nothing goes to an inbox nobody reads.
5. **`verify-code` tries the reviewer code first for that address.** Each attempt is counted
   before the comparison and given back when the code is right, so only wrong codes are counted,
   and no more than 20 are ever counted; the 20th closes the code. A wrong code logs
   `auth.invalid_code_attempt`, which the rejected sign-in codes alarm already counts, and the
   route keeps its limit per client address. A suspended admin is refused without
   counting an attempt, and the admin's e-mail language stays as it was.
6. **Once the code expires or is closed, the address signs in as any other**, with e-mailed
   codes. Sessions the code opened end as any session does.

## Consequences

- A code that leaks lets someone read the projects of one admin, read-only in the dashboard and
  through Claude, until the operator closes it; the reviewer admin is meant to read only a
  project of invented data, never a customer's.
- The reviewer admin still receives the weekly digest every admin receives, so the address
  chosen must receive mail, or that admin turns the digest off in Settings.
- Migration 0029 adds the table; nothing else in the schema changes.
