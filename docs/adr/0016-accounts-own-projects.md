# 16. Accounts own projects; a project without one is the operator's

Date: 2026-10-14

## Status

Accepted. The first step of the hosted plan: sign-up, billing and quotas build on it.

## Context

Until now a project had no owner. The operator created it from the command line
(`project:create`), granted people to it (`admin:grant`) and paid for everything. To offer the API
as a hosted plan, someone other than the operator has to own projects: hold a subscription, be
limited by a plan (3 projects, 3 people, 100,000 events a month) and lose access when the
subscription ends.

Two things had to keep working: the operator's own projects, created long before any plan, and
every self-hosted install, where the operator is the only one who ever creates projects.

## Decision

- **An account is who pays:** one owner (an admin) and the projects it holds. Its status follows
  the subscription's lifecycle (`incomplete`, `trialing`, `active`, `past_due`, `ending`, `ended`)
  or is `comped`, a free account the operator opens by hand (`account:create`).
- **`projects.account_id` is optional, for good.** A project without an account is the operator's:
  no plan, no quota, no billing. Existing projects need no backfill, a migration never has to name
  the operator, and a self-hosted install that never creates an account behaves exactly as before.
- **The plan's limits live in one constant** (`HOSTED_PLAN_LIMITS`), cited by every check. The
  project limit is enforced where projects are created: the account row is locked, its projects
  are counted and the new one is inserted, with its public key and the owner's access, in one
  transaction, so two requests racing for the last place cannot both win.
- **Nothing cascades from an account.** `accounts.owner_admin_id` and `projects.account_id` are
  `RESTRICT`: an account goes only after its projects were deleted on purpose (with their events
  counted, as `project:delete` does), and an owner stays while their account exists.

## Consequences

- Every rule of the hosted plan (quota, people, sign-up, billing) reads the account; none of them
  touches projects without one.
- The `Project` entity does not carry its account yet: the reads that need it go through the
  account repository. It joins the entity when a reader needs it on every project.
- Deleting an account will be its own operation (cancel the subscription, delete the projects,
  then the account), never a side effect of deleting an admin.
