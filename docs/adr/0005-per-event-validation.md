# 5. Validate a batch's envelope at the edge and each event on its own

Date: 2026-10-05

## Status

Accepted

## Context

`POST /v1/batch` receives up to 50 events from a browser. Events come from many versions of the
SDK on many sites, so one malformed event in a batch is expected, not exceptional. ADR 0003 makes
the Zod schema the single definition of every payload, and a NestJS route normally validates its
body against the schema it documents. Validating the whole batch that way would answer 400 to the
batch and lose every valid event in it.

## Decision

- The documented request body is `BatchRequest`: key, `sent_at` and 1 to 50 strict
  `IncomingEvent`s. It is what clients must send, and what the SDK's contract test checks.
- The route validates `batchEnvelopeSchema` instead: the same strict top level with the events
  left opaque, through a pipe of its own. No global schema-validation pipe is registered, because
  it would validate the body against the documented schema.
- The use case validates each event with the domain's `incomingEventSchema`, the same definition
  `IncomingEvent` is generated from. An invalid event is counted in `rejected` with a fixed reason
  (`invalid_schema`, `reserved_rules`, `pii_user_id`, `bot`), logged without its values, and the
  rest of the batch is stored.
- More than 50 events answer 413 from the use case rather than 400 from the schema.

## Consequences

- One bad event never costs the rest of its batch, and the SDK, which cannot see a 400's reason,
  does not drop valid data.
- The contract still has one definition per shape; the envelope differs from the documented body
  only in leaving the events opaque.
- An end-to-end test sends one invalid event among valid ones and expects 202 with `rejected: 1`,
  so a global pipe added later cannot silently change the behavior.
