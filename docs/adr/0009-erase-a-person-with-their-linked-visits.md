# 9. Erase a person together with the visits they identified in

Date: 2026-10-06

## Status

Accepted

## Context

A site that uses Pyxis must be able to honor a deletion request (LGPD, GDPR) for one of its users,
from its own backend, and to export that user's data on request. Events carry a `user_id` only
from the moment the site identifies the person; the page views and clicks before the sign-in, in
the same visit, are anonymous rows that become about that person once `identify` links the visit
to them. The site's backend may retry a call that timed out.

## Decision

- `DELETE /v1/subjects/{userId}` and `GET /v1/subjects/{userId}/events` are server-to-server
  routes authenticated with a secret project key (`Authorization: Bearer pyxis_sk_…`). The key's
  project is the only project touched. The key is looked up by its SHA-256 hash on every call,
  without the 60-second cache public keys have, so revoking it takes effect at once; the hashes
  are also compared in constant time.
- The subject is the user's events **plus** every event of each session that has an `identify`
  for that user, inside the key's project. Erasure deletes that set in a single `DELETE`
  statement, which is atomic, and answers `{ "deleted_events": n }`; `0` is success, so a retry
  is safe.
- The export returns the same set, ordered by `(occurred_at, id)`, 1,000 events per page with an
  `after` cursor; a cursor that names no event of the project is `400 invalid_cursor`.
- The user id is validated against the ingestion format and is never logged: erasure logs
  `subject.erased { projectId, deletedEvents }` only.
- Each secret key may make 60 calls a minute, counted per key in memory.

## Consequences

- After an erasure, no query of the dashboard can show the person: their timeline is empty, and
  their anonymous pre-login visit is gone from every count.
- A visit shared by two people (two `identify` calls with different ids in one session) is erased
  whole when either is erased. That loses some anonymous counts, the safe side for privacy.
- The site keeps its own record of which deletions it requested; Pyxis keeps nothing about an
  erased person, not even the id it erased.
