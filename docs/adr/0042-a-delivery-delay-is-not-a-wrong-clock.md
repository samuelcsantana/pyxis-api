# 42. A delivery delay is not a wrong clock

Date: 2026-10-21

## Status

Accepted. Narrows the rule that every batch's event times are shifted by the difference between
its `sent_at` and the time the API received it.

## Context

The tracker stamps each event with the browser's clock and each batch with `sent_at` when the
batch is built. To survive a browser whose clock is wrong, the ingestion shifted every event of a
batch by `receivedAt − sentAt`, then replaced a time in the future or more than seven days old
with the reception time.

That difference is not only the clock offset. It also holds everything between building the batch
and the use case reading the clock:

- the network, tens to hundreds of milliseconds;
- a cold start: 0.7–1.2 s of Lambda init plus 3.5–4.2 s of bootstrap inside the first invocation
  (Parameter Store, the database connection), measured in the function's REPORT lines on
  2026-10-21;
- the tracker's retries, which resend the same serialized batch, so `sent_at` stays at build time:
  1, 2, 4, 8 and 16 seconds apart with 20% jitter, or the `Retry-After` of a `429` (up to 60 s)
  when it is longer.

Each batch was moved by its own delay, so two batches of one visit could interleave. An install
rehearsal on 2026-10-21 showed it: a visit through a cold function came back with `order_placed`
before `product_added_to_cart` and squeezed into four seconds, because its first batch was moved
4.3 s later and its second, on a warm function, 0.1 s.

## Decision

1. **A batch that arrives between 0 and 5 minutes after its `sent_at` keeps the browser's times**
   (`MAX_DELIVERY_DELAY_MS`). That window covers the network, a cold start and every retry the
   tracker makes, including five `Retry-After` waits of a minute.
2. **A batch whose `sent_at` is later than its arrival is shifted, as before.** Delivery can only
   make the difference positive, so a negative one is a browser clock that runs ahead, by at least
   that much. Shifting keeps every time at or before the arrival.
3. **A batch that arrives 5 minutes or more after its `sent_at` is shifted, as before:** that is a
   browser clock running behind.
4. The two replacements stay: a time still in the future, or more than seven days old, becomes the
   reception time. An event is never stored later than its arrival.

## Consequences

- The events of a visit keep the order and the gaps the browser saw when the clock is right or
  behind by less than 5 minutes, whatever the function's state.
- A clock behind by less than 5 minutes is no longer corrected: its events are stored up to that
  much early, in the right order. Reports group by day and by hour, so the error stays inside the
  bucket almost always.
- A clock ahead by more than the delivery delay is still shifted by `receivedAt − sentAt`, which
  includes that batch's delay: such a visit can still interleave across a cold start. Measuring
  the reception before the bootstrap (the function URL's request time) would close it, at the cost
  of carrying that time from the Lambda adapter to the use case.
- The tracker needs no change and no release. Refreshing `sent_at` on each retry would make the
  window smaller, in a tracker release of its own.
