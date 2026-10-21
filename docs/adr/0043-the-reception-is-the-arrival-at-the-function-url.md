# 43. The reception is the arrival at the function URL

Date: 2026-10-21

## Status

Accepted. Amends [ADR 0042](0042-a-delivery-delay-is-not-a-wrong-clock.md): closes the case it
left open and corrects what it said about the tracker's retries.

## Context

ADR 0042 keeps the browser's times for a batch that arrives less than 5 minutes after its
`sent_at`, and still shifts a batch whose `sent_at` is later than its arrival: a browser clock
running ahead. The shift is `receivedAt − sentAt`, and `receivedAt` was the use case's clock, read
after a cold start had added 0.7–1.2 s of Lambda init and 3.5–4.2 s of bootstrap. Each batch of
such a browser was moved by its own wait, so a visit could still interleave across a cold start.

ADR 0042 also says the tracker resends the same serialized batch on a retry, so `sent_at` stays at
build time. It does not: the tracker builds the batch again for every attempt, with the time of
that attempt, since pyxis-analytics 0.1.0 (its test "retries a failed batch with the same event
ids and a fresh sent_at"). Retries never added to the difference; between a batch's `sent_at` and
its arrival there is only the network.

## Decision

1. **The function URL's record of the arrival reaches the application.** The function URL notes
   when it received each request (`requestContext.timeEpoch`), before the function runs. The
   Lambda proxy hands that time to the application as the `x-pyxis-arrived-at` header, written
   over any value the client sent, as CloudFront writes its viewer headers.
2. **The ingestion takes that arrival as the reception time**: for the project rate limit, the
   monthly pause, the stored `received_at` and the correction of the event times.
3. **The use case's clock stays the fallback** when the header is missing or malformed (the
   application outside the function: the local stack, the end-to-end tests), later than the
   clock, or older than 30 seconds, the function's timeout (`MAX_ARRIVAL_AGE_MS`): no request is
   handled for longer, so an older value is not an arrival.

## Consequences

- A browser clock running ahead is corrected by its own offset, network aside, whatever the
  function's state: the events of a visit keep their order across a cold start.
- `received_at` is up to a few seconds earlier for the requests that waited for a cold start: it
  is the time the request reached the API, not the time the function got to it.
- ADR 0042 sized its 5-minute window for five retries behind a minute-long `Retry-After`. With a
  fresh `sent_at` on every attempt and the reception taken at the arrival, a correct clock arrives
  within the network time of its `sent_at`, so the window is wider than delivery needs and a clock
  up to 5 minutes behind stays uncorrected. Narrowing it is a product decision, not taken here.
- The header is trusted because the proxy writes it. An application served outside the Lambda
  proxy would read a client's value; the 30-second bound limits how far such a value can move the
  reception.
