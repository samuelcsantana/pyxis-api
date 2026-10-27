# 47. A filter selects visits, and every report counts their events

Date: 2026-10-27

## Status

Accepted.

## Context

Only the Visits list could be filtered. The funnel could be split by device or channel, and
every other screen showed the whole project. Comparable products filter the whole dashboard with
one click: "mobile", "from Instagram", "visits that signed up".

A filter can mean two things. It can select events, so that "event = signup_completed" on
Features shows only that event; or it can select visits, so that every screen shows what those
visits did. The second answers the questions people ask ("what do the visits that signed up use?",
"where do mobile visits come from?") and keeps every screen's numbers consistent with each other.

Every report adapter already reads its events through one predicate, `inScope(scope)`, which
holds the project, the range in the project's time zone and the cutoff of an unfinished day
([ADR 0010](0010-compare-an-unfinished-day-up-to-the-same-time.md)); a spec fails when an adapter
reads events without it.

## Decision

- Every report endpoint (overview, time of day, devices, acquisition, features and their property
  breakdown, engagement, requests, funnel with its segments and subjects, visits) takes the
  filters of the Visits list as optional query parameters, in the same names and formats, plus
  `browser` and `os`: up to three pages viewed (a star as wildcard), a named event with an
  optional property value, channel, device type, browser, operating system, identity, country,
  region, source, campaign and a failed request. Every filter given must hold. `route` stays on
  Visits; Requests keeps its own `route`.
- **A filter selects visits, and every number is computed over the events of those visits**, in
  the current period and in the previous one. In the previous period the cutoff applies to the
  filter too: a visit is selected by what it did up to that time.
- The filters ride on the query scope. The scope requires them, so no adapter can leave them out,
  and `inScope` applies them:
  - device type, browser and operating system compare each event directly. The ingestion
    classifies them from the user agent of the browser tab, so they are the same on every event
    of one visit, and an indexed scan of the asked events is cheaper than grouping the period;
  - every other filter selects visits with a semi-join:
    `session_id IN (SELECT session_id FROM events WHERE <period> GROUP BY session_id HAVING …)`.
    The inner table shadows the outer one, so the subquery is uncorrelated and Postgres runs it
    once per statement as a hashed aggregate under a hash join.
- A condition holds for a visit when any of its events satisfies it (`bool_or`): a page it
  viewed, an event it sent, a country or region it was in. Source and campaign are read on the
  entry page views, where attribution is recorded. A visit is identified when any event carries
  a user id, so one that identified at its end is not anonymous. The Visits list used to compare
  with the visit's first value; `bool_or` needs no ordering inside a visit and serves both, and a
  visit whose country or region changes mid-visit now matches either one.
- In the funnel's user mode, both the link from a visit to its person and the steps read only
  the events of the selected visits: a person's step counts only when it happened inside a visit
  the filters select. Someone who took the first step on a laptop and the second, later, on a
  phone reaches both steps unfiltered, the first only under "desktop", and none under "mobile",
  where the second step alone does not start the funnel.
- The Visits list keeps its own grouping and its route filter: with a route, a failed request
  means a failed call to that route.
- Left unfiltered by construction: arrivals (their counts would not match the filtered numbers,
  and filtering them would cost a filtered read every 30 seconds per open tab), the weekly digest,
  the exports, the settings, the timeline (one person or one visit) and the MCP tools. Arrivals
  and the timeline refuse the filter fields as unknown, with 400.
- No "N of M visits" base is added to the answers: they keep their shapes, and the filtered
  Overview's visits are the base.

## Consequences

- Without a filter, `inScope` is the period predicate itself: the same SQL text and parameters as
  before, and the same answers.
- Measured on the ADR 0008 recipe (one million events of one project over 90 days, 30 days of
  them, about 330,000 events, in range), the use cases run the way the endpoints run them, best
  of three runs after a warm-up, two series:

  | Report (30 days)  | No filter  | `device=mobile` | `event=signup_completed&channel=paid` | `country=BR` |
  | ----------------- | ---------- | --------------- | ------------------------------------- | ------------ |
  | Overview          | 619–748 ms | 213–273 ms      | 395–549 ms                            | 936–940 ms   |
  | Devices           | 463–482 ms | 211–278 ms      | 387–470 ms                            | 661–817 ms   |
  | Features (events) | 214–280 ms | 168–187 ms      | 383–391 ms                            | 565–566 ms   |

  Through the semi-join alone, `device=mobile` took 533–577 ms on Features, 2.4 to 2.7 times its
  unfiltered time, which is why the device fields compare events directly. On that recipe the
  device, browser and country rotate on every event, so a "visit" there has every value and
  `country=BR` selects almost every visit: it is the worst case of the semi-join, a full grouping
  of the period on each statement. Features, which unfiltered reads only the named events, pays
  the most for it relative to its own time.

- A visit that started before `from` has its entry page view outside the range, so a channel,
  source or campaign filter does not select it; the Visits list behaves the same.
- If the classification ever differed between the events of one tab (a client hint sent on some
  requests and not on others), the reports would count only that visit's events on the asked
  device, browser or system, while the Visits list would list the visit under either value.
- If a project outgrows the grouping, a table of visits kept by the ingestion is the next step;
  the conditions of `reportFilterConditions` already say what each filter means per visit.
- Because arrivals are not filtered, the dashboard is to pause its "new since you looked" marks
  while a filter is on. The MCP tools learn the filters in a later release of `pyxis-mcp`.
