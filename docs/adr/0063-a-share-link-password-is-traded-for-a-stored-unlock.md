# 63. A share link's password is traded for a stored unlock

Date: 2026-11-05

## Status

Accepted. Builds on [ADR 0060](0060-a-public-share-link-opens-only-aggregate-reports.md) (the
share link, its allowlist and its single 404) and
[ADR 0057](0057-pro-features-are-gated-by-the-account-status.md) (Pro features). It adds the
optional password ADR 0060 left room for in `share_links.password_hash`.

## Context

A share link is a bearer credential that travels by chat and e-mail. Some owners want a second
factor the link alone does not carry: a password they give the viewer another way. The dashboard
reads the shared reports from the viewer's browser (ADR 0060, point 6), so whatever proves the
password was typed must travel with each of those requests, and must stop working when the owner
changes the password or revokes the link.

## Decision

1. **The password.** 8 to 128 characters, counted as characters and kept exactly as typed (no
   trimming: a space is part of it). The edge accepts at most 512 UTF-16 units. The owner sets it
   when creating the link (`password` on `POST .../share-links`) or later with
   `PATCH /v1/projects/{projectId}/share-links/{linkId}` `{ "password": "…" | null }`, from the
   dashboard; both go through the same access checks and `requireProFeature(account,
'public_share_link')` as creating a link. Lists and answers carry `password_protected`, never
   the password or its hash. Logs carry ids and `passwordProtected` only.
2. **Stored as scrypt, with its parameters.** Node's own `crypto.scrypt`, no new dependency:
   N = 16384, r = 8, p = 1, a 32-byte key and a 16-byte random salt per hash, stored as
   `scrypt$N$r$p$salt$key` in `password_hash`. Verifying reads the parameters stored with the hash,
   so raising them later only changes new hashes; derived keys are compared with
   `timingSafeEqual`. `maxmem` is set from N and r, since Node refuses 128·N·r above 32 MiB.
3. **The password is traded for an unlock.** `POST /v1/shared/{token}/unlock` `{ "password" }`
   answers `{ "unlock": "pyxis_su_…", "expires_at" }`: 32 random letters and digits (about 190
   bits), valid eight hours, kept only as its SHA-256 in `share_link_unlocks` with its link and
   expiry. The browser keeps it in memory or the tab's `sessionStorage` and sends it as
   `Authorization: Bearer pyxis_su_…` with every `/v1/shared/{token}` call; `/v1/shared` preflights
   now allow the `Authorization` header from the dashboard's origin, and no cookie is set on the
   API's domain.
4. **No signing secret.** An unlock is not a signed token: it is itself the secret, looked up by
   its hash and bound to its link's id in the database. So nothing new goes to Parameter Store and
   no infrastructure changes. Revocation is deletion: changing or removing the password deletes
   the link's unlocks in the same transaction (and resets its failure count), revoking the link
   deletes them by cascade, and an expired one fails the lookup. Issuing an unlock deletes the
   link's expired ones, so the table holds at most what the rate limits let through in eight hours.
5. **What a locked link answers.** The order of checks never changes: a closed link (unknown,
   revoked, expired, off Pro, suspended) answers the single `404 share_link_not_found` of ADR 0060
   first, to the unlock route too, whatever the password. Then, for a link with a password and no
   live unlock of that link, `GET /v1/shared/{token}` answers exactly `{ "password_required": true }`
   and nothing about the project, and every report (annotations included) answers
   `401 share_password_required`. An unlock of another link opens nothing.
6. **Guessing costs the same as reading, and a lockout says nothing.** The unlock route has its
   own throttler: 20 attempts per 15 minutes per client address (`getClientIp`), counted before the
   token is looked at. Each link also counts its wrong passwords in a 15-minute window held on the
   row; at 50 the link refuses every attempt, the right password included, until the window ends.
   That refusal is byte for byte the answer of a busy address (`429 rate_limited`, the same
   message, `Retry-After`), so an attacker cannot tell a locked link from a throttled address. A
   wrong password answers `401 wrong_share_password`; a link without a password answers
   `409 share_password_not_set` (the holder of the token already sees that the link opens). Logs
   of wrong passwords name the link only, never the address.

## Consequences

- Migration 0048 adds `share_link_unlocks` and the failure window on `share_links`; existing links
  keep `password_hash` empty and open as before.
- The dashboard asks for the password when the info route answers `password_required`, keeps the
  unlock for the tab, and asks again on a 401 from a report.
- A viewer locked out by someone else's guessing waits at most 15 minutes; the owner can also set
  a new password, which clears the count at once.
- Raising the scrypt cost is a change of `CURRENT_SCRYPT_PARAMETERS`; old hashes keep verifying.
