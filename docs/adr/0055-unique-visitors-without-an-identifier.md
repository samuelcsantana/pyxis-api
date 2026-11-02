# 55. Unique visitors without an identifier

Date: 2026-11-02

## Status

Accepted.

## Context

Pyxis counts visits: a visit is one browser tab, and nothing links two of them. The contract
says so (Terms 1.4, clause 4.2 item 7: the anonymous visitor is not recognized on another
visit). Every direct alternative leads with unique visitors instead, and a site owner who compares
Pyxis with Google Analytics reads the gap as missing data.

Three ways to count unique visitors were weighed:

1. **A random identifier kept in the browser.** Exact across days and months, and what Google
   Analytics does; but it is a persistent identifier on the visitor's device, which turns every
   visit of that browser into one linked history, and a site using Pyxis could no longer do
   without a consent banner on the grounds that nothing persistent is kept.
2. **A daily hash of the IP address and the user agent with a rotating salt**, as Plausible,
   Fathom and Umami do. Nothing is kept in the browser, but the server must read the address on
   every batch to derive it, it can count a visitor only within a day, and visitors behind one
   carrier gateway collapse into one.
3. **A date marker in the browser.** The browser keeps only when the site's day and month end:
   two instants that are the same for every visitor of that site on that day. On each new visit
   it compares them with its own clock and says what kind of visit this is. No identifier is
   created, stored or sent, and the server still cannot link one visit to another.

The third was chosen: it gives the numbers owners ask for (unique visitors per day and per month,
new against returning) while keeping the server's promise intact.

## Decision

- **A setting of each project, `visitors_enabled`, false by default**, on both plans. The owner
  changes it in the dashboard (`PATCH /v1/projects/{id}`); the operator's projects, which have no
  owner, change it with `project:update --visitors-on | --visitors-off`.
- **The event carries a kind, never an identifier.** An incoming event may carry
  `visitor`, one of `first_visit` (no marker: this browser's first visit, or its marker was
  cleared), `first_this_month` (the month in the marker has ended), `first_today` (the day has
  ended, the month has not) and `again_today`. The tracker sends it on the visit's first event, as
  it does the attribution; the API accepts it on any event. Any other value rejects the event as
  `invalid_schema`.
- **The answer carries the period, only when the option is on.** For a project with the option on,
  the answer to every batch it processed, those refused whole as a bot or from a data center
  included, gains `visitor_period: { day_ends_at, month_ends_at }`: the next midnight and the first
  instant of next month in the project's time zone, as UTC instants, from the batch's reception
  time. A successful answer without it tells the tracker to delete its marker. A batch refused
  before the project is known answers as before. The start of a local date is the first second
  whose local date is that date or later, so a midnight skipped by summer time (São Paulo until 2019) starts the day at 01:00, and a day a zone skipped (Samoa, 2011-12-30) ends at the next one.
- **Kept only when on.** Ingestion stores the kind (`events.visitor`, nullable, checked against
  the four values) only for a project with the option on; otherwise it drops it silently and the
  event stays accepted.
- **Turning it off keeps what was stored.** The kinds already stored follow the rules of every
  other field of the event: the 13-month retention, the project's deletion and the erasure of an
  identified person. They have no retention step of their own. On a site that calls `identify`, a
  kind stored next to a user id is personal data like the rest of that person's events, so the
  person's copy and erasure include it.
- **Exports carry it:** the project's CSV export and the copy of an identified person's events
  gain `visitor`.

## Consequences

- Nothing changes for any project until its owner turns the option on. The site's privacy notice
  must say that the browser keeps the marker before it is turned on.
- The counts follow from the kinds, in the project's time zone: unique visitors of a day are the
  visits of that day with `first_visit`, `first_this_month` or `first_today`; of a month, those
  with `first_visit` or `first_this_month`, exact for a whole month and for the month to date;
  new visitors are `first_visit`. The reports are a separate change.
- The measurement has limits, said where the numbers are shown:
  - a visit that ends before the tracker's first answered send (about five seconds; a hidden tab
    sends with `sendBeacon`, which has no answer) stores no marker, so a visitor who leaves quickly
    comes back as `first_visit` and is counted again;
  - two tabs opened at once on the first visit of the day count twice;
  - a private window, a cleared browser, or a phone and a computer count as different visitors,
    as in every alternative;
  - the browser's storage is per origin, so `www` and the bare domain keep different markers
    unless the site redirects one to the other;
  - unique visitors of different days cannot be added up: two days of 100 each may be 100 or 200
    people.
- The project lookup of ingestion is cached for 60 seconds per function instance, so turning the
  option on or off takes effect within a minute.
- **The API ships before the tracker that sends the field.** `incomingEventSchema` is strict, so an
  API without this change refuses every event that carries `visitor`; the tracker's release waits
  for this API in production.
- In the European Union, storing anything on the visitor's device may need consent (ePrivacy
  article 5(3)) even when it identifies no one; a site that serves visitors there weighs that
  before turning the option on.
