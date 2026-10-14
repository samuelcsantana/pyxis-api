# 20. Owners manage their projects from the dashboard; the operator's stay in the command line

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts own projects) and
[ADR 0019](0019-sign-up-behind-a-switch-and-the-terms-version.md) (sign-up).

## Context

Until now every project was created, changed and given keys by the operator through the command
line. An owner who signs up must do all of that alone: create up to the plan's three projects,
change their origins and time zone, rotate the public key and create or revoke secret keys. The
command-line use cases already hold the rules, but none knows who is asking, and key revocation
takes only a key id, so exposing it as is would let any admin revoke any key.

## Decision

- **Only the owner of the project's account changes it.** Anyone else, including an admin who
  reads the project, is answered "not found", the same answer as for a project that does not
  exist. The operator's projects have no account, so the dashboard cannot change them; they stay
  in the command line.
- **The dashboard routes wrap the command-line use cases** with the ownership check, so the rules
  (names, origins, time zones, the plan's three projects counted under a lock) live in one place.
- **Changes need an account with access** (trialing, active, past due, ending or comped). An account
  that never subscribed or has ended is refused with `409 subscription_required`. Deleting a
  project is allowed in any state: the data is the owner's.
- **A key is revoked only among the live keys of the project named in the path.** A key id from
  another project is not found, even when the same owner holds both.
- **The last live public key cannot be revoked** (`409 last_public_key`): the site's events would
  stop. Rotating is creating a new public key, putting it on the site, then revoking the old one.
- **Limits:** five allowed origins per project and five live keys of each kind, so one project
  cannot open ingestion to any number of sites or pile up secrets.
- **Deleting is `POST .../delete` with the name typed again** in the body, instead of a `DELETE`
  with a body, which not every proxy keeps.
- **The settings of a project say who may change it:** `account_id` and the admin's `role`
  (`owner`, `member`, or null for the operator's projects), so the dashboard shows the editing
  controls without another request.

## Consequences

- The operator keeps full control of the projects outside the hosted plan, and the hosted owners
  cannot reach them.
- The owner counts as one of the people of the account, since the access that lets them read the
  project is the same row a guest gets; whether the owner counts toward the plan's three people is
  decided with the invitations.
