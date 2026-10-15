# 30. The operator can stop a person and a token

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0007](0007-email-code-sign-in-with-opaque-sessions.md) (sessions),
[ADR 0015](0015-read-only-access-tokens-for-agents.md) (access tokens) and
[ADR 0027](0027-a-suspension-is-a-mark-not-a-status.md) (marks).

## Context

The terms let the operator suspend one person's access to the dashboard, without suspending the
whole account, and revoke a key or a token that was published. Only the person could end their
own sessions and tokens; the operator's only tool was deleting rows by hand, and nothing kept the
person from asking for a new sign-in code right after.

## Decision

1. **`admin:suspend --email <email>`** marks the person (`admin_users.suspended_at`, migration
   0021), ends every live session of theirs and revokes every live token, and reports how many.
   Their project grants are kept. **`admin:resume --email <email>`** lifts the mark; the ended
   sessions and tokens stay ended.
2. **The mark is checked wherever a person gets in:** `request-code` keeps answering 202 but
   sends no code; `verify-code` refuses a code sent before the suspension as an invalid code; a
   sign-up that would reuse the person refuses the same way; and authenticating a session or a
   token refuses a suspended person even if a session survived.
3. **`token:revoke --token <id>`** revokes any person's token by the id the dashboard's Tokens
   panel shows, for a token published by mistake.

## Consequences

- A suspended person is told nothing by the API (the same 202 as anyone); the operator writes to
  them, as the terms say.
- Checking the mark costs nothing extra: the admin is already read on every authentication.
- Project keys keep their own command (`key:revoke`); this one is for read-only tokens.
