# 58. Goals replace the single conversion event

Date: 2026-11-04

## Status

Accepted. Extends [ADR 0047](0047-a-filter-selects-visits.md) (a filter selects visits) with a
filter on goals.

## Context

Until now a project had one conversion event (`projects.conversion_event`), counted as
conversions by the Overview, Devices, Acquisition and Arrivals. A site usually has more than one
thing worth counting (a sign-up, a purchase, a thank-you page) and some of them are a page, not
an event the site sends. The product owner decided on up to ten goals per project, each a named
event or a page path pattern where a star matches any characters, in both plans, and that the
existing conversion event becomes the first goal with no action from the customer.

The API ships before the dashboard. The deployed dashboard and the Claude connector read
`conversion_event` from `/v1/me`, `/v1/projects/{id}/settings` and the PATCH answer, write it
through `PATCH /v1/projects/{id}` and the project creation, and parse some answers strictly. They
must keep working against the new API until the dashboard ships its goals screen. The API image
is also rolled back by redeploying the previous image, with the database already migrated.

## Decision

1. **A `goals` table** holds the goals: project, name, kind (`event` or `page`), the event name or
   the path pattern (a check constraint keeps exactly the one of its kind), a position and the
   creation time. The position orders them; the lowest is the **first goal**. Deleting a goal
   leaves a gap, never a renumbering. Names may repeat. The goals go away with their project.
2. **The migration copies** each project's conversion event into its first goal, named after the
   event, only for a project that has one and no goal yet, so running it again changes nothing.
3. **A page goal matches as a Funnel page step does**: a page view whose path matches the pattern,
   `*` for any characters, `%` and `_` taken literally. An event goal matches events of that name.
4. **Reports say which goal they count.** `goal=<id>` on the Overview, Devices, Acquisition and
   Arrivals picks the goal counted as conversions; without it they count the first goal, which is
   the former conversion event, so every current caller sees the same numbers. A project without
   goals answers `null` conversions, as before. `reached_goal=<id>` joins the visit filters, so
   any report can keep only the visits that reached a goal. An id that is not one of the
   project's goals answers `404 goal_not_found`. `GET .../goals/summary` counts every goal in one
   pass over the events, for the dashboard's Goals table.
5. **The old column stays, as a mirror of the first goal**, until the dashboard no longer uses it:
   `projects.conversion_event` holds the first goal's event name, or null when the first goal is
   a page or there is none. Every write that can change the first goal (creating, editing or
   deleting a goal) rewrites it in the same transaction. The legacy `conversion_event` field
   writes the first goal: a name replaces the first goal's target (and its name while the name is
   still the old event's), or creates the first goal; `null` deletes the first goal. So every
   answer that carries `conversion_event` keeps its meaning and no answer changes its shape, and
   an image rolled back to before this change reads a column that still names the first goal
   whenever it is an event.
6. **Who may do what** follows the project settings: any admin who reads the project lists the
   goals and their summary (an access token too); only the owner of the account, with access to
   the plan, from the dashboard, creates, edits and deletes them.

## Consequences

- Removing the column is a later change, once the dashboard reads and writes goals itself: a
  migration that drops `projects.conversion_event`, and the legacy field removed from the
  contract in a major version of the API's answers.
- The weekly digest still counts the mirrored event, so a project whose first goal is a page has
  no conversions in its digest until the digest reads the goals.
- The access guard reads the project's goals with its account state, one indexed query in
  parallel, so every report resolves `goal` and `reached_goal` without another round trip.
- Up to ten goals keep the summary to one scan with twenty filtered aggregates; a larger limit
  would need a different query.
