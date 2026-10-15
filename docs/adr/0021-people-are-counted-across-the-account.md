# 21. People are added per project and counted across the account

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0020](0020-owners-manage-their-projects-from-the-dashboard.md).

## Context

The hosted plan includes three people. Access has always been a row per admin and project
(`admin_project_access`), granted by the operator with `admin:grant`, and every report, the
weekly digest and the read-only tokens already follow it. The owner of an account now needs to
add and remove the people who read its projects, without an operator.

## Decision

- **People are added to a project, not to the account.** The owner adds an e-mail address to one
  project at a time; the access row is the same one `admin:grant` writes, so nothing downstream
  changes. A person who should read two projects is added to both.
- **The plan's three people are the distinct admins with access to any project of the account,
  the owner included.** Adding someone already on another project of the account takes no new
  place. The count and the insertion run in one transaction holding the account row lock, the same
  lock project creation takes, so two additions cannot both take the last place.
- **The owner always keeps their access**: removing them is refused (`409 owner_stays`), from the
  dashboard and from `admin:revoke` alike.
- **A new person receives an invitation e-mail**, best effort, written in the language of the
  owner's page, naming who added them; replies go to that person. There is no invitation token:
  the e-mail only says to sign in with that address, which the usual sign-in code then proves.
- **Anyone on the project lists its people**; only the owner adds and removes, and anyone else is
  told the project does not exist. Adding needs an account with access; removing does not.

## Consequences

- An owner who wants a guest on every project adds them to each, and a new project starts with the
  owner alone.
- A removed person keeps their sessions; they simply stop reaching that project. People left with
  no project at all are cleaned up by the account lifecycle job.
