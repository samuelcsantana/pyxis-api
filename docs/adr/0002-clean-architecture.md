# 2. Clean Architecture with ports and adapters

Date: 2026-10-05

## Status

Accepted

## Context

The API has rules that must be easy to prove: what may be stored, what is dropped as personal
data, how a clock skew is corrected, which events an erasure removes. It also has I/O that changes
over time: the database, the mail provider, the runtime (a Lambda function today).

## Decision

The code is split into four layers, with dependencies pointing inward only:

- `domain/`: entities, value objects, pure rules, and the ports (interfaces plus dependency
  injection tokens) for every external input or output, including the clock and id generation.
- `usecases/`: one class per business operation, depending only on domain ports.
- `infra/`: adapters for those ports (Drizzle repositories, HTTP controllers, mail, Lambda
  handlers). Controllers only validate input, call one use case and map domain errors to HTTP.
- `test-utils/`: in-memory fakes of every port, interchangeable with the real adapters.

Nothing in `domain/` or `usecases/` imports from `infra/`.

## Consequences

- Business rules are unit-tested without a database or a network, which keeps the 100% coverage
  gate cheap to maintain.
- Every external dependency needs a port, an adapter and a fake: more files, in exchange for
  adapters that can be swapped without touching a use case.
- Repositories return domain entities, never ORM rows, so the database schema can change without
  rippling into the rules.
