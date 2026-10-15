# 32. A project's reception can be suspended on its own

Date: 2026-10-15

## Status

Accepted. Narrows [ADR 0027](0027-a-suspension-is-a-mark-not-a-status.md) (a suspension is a
mark on the account) to one project.

## Context

The terms list graduated measures against abuse, from a warning up to closing the account. One of
the partial ones is to pause the event reception of a single project, for example a site that
sends e-mail addresses in its events, while the rest of the account and every screen keep working.
The only suspension the service had covered the whole account, screens included.

## Decision

1. **Two columns on the project, `ingestion_suspended_at` and `ingestion_suspension_reason`**, set
   and cleared by the operator with `project:suspend --project <id> --reason "…"` and
   `project:resume --project <id>`. Writing the reason again keeps the moment of the first
   suspension.
2. **Only the reception stops.** The ingestion reads the mark through the same state it already
   reads for a pause or a suspended account (cached for a minute), as a field of its own,
   `ingestionSuspended`, and answers `403 project_suspended` with the CORS grant, so the tracker
   drops the batch. The guard of the project screens never reads that field: queries, settings,
   exports and people stay open.
3. **It works on any project**, the operator's own included: the state joins the account only when
   there is one.
4. **The dashboard learns of it from the project itself**: `GET /v1/me` and the project settings
   carry `ingestion_suspended_at` for everyone who reads the project and
   `ingestion_suspension_reason` for the owner of its account only.
5. **A suspended account wins.** When both apply, a batch is answered `account_suspended`.

## Consequences

- Billing does not change while one project is suspended, as the terms say.
- Lifting the suspension takes up to a minute, like the account's, and both commands say so.
- Nothing is e-mailed by the service: the operator writes to the owner with the reason.
