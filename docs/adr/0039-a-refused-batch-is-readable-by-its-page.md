# 39. A refused batch is readable by the page that sent it

Date: 2026-10-18

## Status

Accepted. Replaces the rule that a batch from an origin the project does not allow gets nothing it
can read.

## Context

The tracker sends a batch with `fetch` in CORS mode, without credentials, and retries a network
error five times, 1, 2, 4, 8 and 16 seconds apart. The ingestion answered `401 unknown_key` and
`403 origin_not_allowed` without `Access-Control-Allow-Origin`, so the browser hid those answers
and the tracker saw a network error. Every visitor of a site whose key was revoked (an ended
account, a revoked key, a deleted project) or whose origin is missing from the project (the `www.`
host, a new domain) sent each batch six times, and each request with an unknown key cost a
database query: the key cache keeps only the keys it finds. Measured locally on 2026-10-18 with
the published tracker and a random key: six requests for one batch, the last one 28 seconds after
the first.

The refusals that already carried the grant (`quota_exceeded`, `account_suspended`,
`project_suspended`, the project-level `429`) were readable for this reason: the tracker has to see
the status to drop the batch.

## Decision

1. **`unknown_key` and `origin_not_allowed` grant CORS to the request's `Origin`**, echoed, with
   `Vary: Origin`, never `*` and never credentials. The domain errors carry that origin (and
   `origin_not_allowed` the project), and the error answer reads it, as it reads the allowed
   origin of the other refusals.
2. **A missing or opaque (`null`) `Origin` gets no grant.** Nothing in a browser needs it, and the
   routes authenticated by a secret key, which also answer `unknown_key`, are not called from a
   page.
3. **The other refusals of the route stay unreadable:** `400` for a malformed batch, `413` for a
   body over the limit and the per-address `429`. The tracker never sends a malformed or oversized
   batch, and it retries a `429` either way.
4. **Each refusal of the two is logged** as `ingest.batch_refused`, with the request id, the
   reason, the `Origin` and, for `origin_not_allowed`, the project. Never the key.

## Consequences

- A page whose batch is refused sends it once. Measured locally after the change: one request for
  the same batch.
- Any page can now read whether the key it sent is unknown or not allowed for its origin. That is
  the error code and message a request from `curl` already gets for the same body; public keys are
  32 random characters, so the answer is no help in finding one, and it never echoes the input.
- The log shows how many visitors still run a revoked key or a site whose origin is missing, which
  was invisible before.
- The tracker needs no change and no release: it already drops a readable `401` or `403`.
