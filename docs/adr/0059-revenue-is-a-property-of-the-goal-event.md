# 59. Revenue is a property of the goal's event

Date: 2026-11-05

## Status

Accepted. Builds on [ADR 0058](0058-goals-replace-the-conversion-event.md) (goals).

## Context

Sites want to see how much money a goal brought, next to how many times it was reached. The
product owner decided that revenue arrives as a numeric `revenue` property on the event, in the
project's currency (BRL by default), with no exchange rates, in both plans.

Before this change the tracker already kept finite numbers, and the ingestion already accepted
`revenue: 129.9` and stored it in the event's JSON properties unchanged. Nothing checked that a
`revenue` was a usable amount: a string, a negative number or an absurd one would have been stored
and, once summed, would have corrupted every total.

## Decision

1. **A valid revenue is a JSON number, at least 0 and below 1,000,000,000.** The upper bound is
   the personal-data barrier's threshold (numbers of ten or more integer digits look like phone
   or tax numbers and are already dropped). It guards the shape of the data, not business sense:
   one bound fits every currency, from BRL to JPY or IDR, without a table per currency. Decimals
   are kept as sent, so a currency with three decimals works too.
2. **The ingestion drops an invalid `revenue` and nothing else.** The event is stored without that
   property, and the drop is logged as `ingest.property_dropped` with the reason
   `invalid_revenue`, like any other dropped property. A value is never clamped, rounded or
   converted: it is accepted whole or not at all. The check runs before the personal-data
   barrier, so a ten-digit revenue is reported as `invalid_revenue`. Negative amounts (refunds)
   are not supported yet.
3. **The queries count only a valid revenue too**, with the same bound in SQL, so events stored
   before this change cannot reach a total. The value is read only when its JSON type is a
   number, summed as `numeric` and answered as a JSON number.
4. **Revenue belongs to a goal.** The revenue of a goal is the sum of `revenue` on the events the
   goal counts. A page goal counts page views, which carry no revenue: its revenue is `null`, not
   zero, so a screen can tell "no revenue possible" from "none yet". The same holds when the
   project has no goal.
5. **Where it is answered:** the Overview's `revenue` KPI for the goal chosen with `goal` (the
   first goal by default), against the previous period, day by day; each row of the goals
   summary; each source, campaign and channel of Acquisition (the revenue of the conversions made
   by the visits that entered through it); and each event step of a funnel, where it is the
   `revenue` of the event that completed the step for each visit or person, that is the first
   matching event after the previous step, ties broken by event id. Later purchases by the same
   visit do not add to the step, as they do not add to its count.
6. **The currency is a project setting**, `projects.currency`, an ISO 4217 code checked against
   the runtime's list of currencies, `BRL` by default. It only labels the amounts: changing it
   converts nothing.

## Consequences

- The Overview reads revenue in separate queries, run only for an event goal, so the existing
  totals, the weekly digest and every report without revenue cost nothing more.
- A site that sends the amount as a string ("129.90") gets it dropped and logged; the install
  instructions show a number.
- Refunds, currencies per event and exchange rates would each need a new decision.
