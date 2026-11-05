# 62. Annotations are notes on a day, written by the owner

Date: 2026-11-05

## Status

Accepted for the dashboard and the readers. Writing an annotation with a token is left open (see
"Open decision"). Builds on [ADR 0015](0015-read-only-access-tokens-for-agents.md) (access tokens
are read-only), [ADR 0020](0020-owners-manage-their-projects-from-the-dashboard.md) (the owner
changes the project), [ADR 0057](0057-pro-features-are-gated-by-the-account-status.md) (the Pro
feature `annotations_by_token`) and
[ADR 0060](0060-a-public-share-link-opens-only-aggregate-reports.md) (the share link's allowlist).

## Context

A chart that jumps or falls raises the question of what happened that day: a launch, a campaign,
a deploy, an outage. Plausible, Fathom and Google Analytics let a team write that down on the
chart. Pyxis keeps no such note, so the explanation lives in someone's memory.

## Decision

1. **An annotation is a short note on a day of a project:** a day, in the project's time zone,
   and a text of 1 to 140 characters, counted as characters (an emoji is one, as Postgres counts
   `varchar(140)`), with runs of spaces and line breaks collapsed into one and the ends trimmed.
   The day is today at the latest in the project's time zone; a note on a day still to come
   would mark a chart that has no such day yet. The edge accepts at most 280 UTF-16 units before
   the domain counts the characters.
2. **The account's owner writes them, from the dashboard,** in both plans:
   `POST /v1/projects/{projectId}/annotations`, `PATCH` and `DELETE .../annotations/{id}`, with
   the session and the dashboard's origin, through the same `changeableProject` as the goals,
   the keys and the project settings. The other people of a project read it (`role: member`)
   and change nothing in it today; letting them write notes would be the first exception to
   that rule, and it can come later as its own decision without a migration.
3. **Anyone who reads the project reads them:** `GET /v1/projects/{projectId}/annotations?from=&to=`
   for a session or an access token, with the same range rules as the reports (400 days at most,
   ending today at the latest), by day and then in the order they were written.
4. **The public share link shows them too:** `GET /v1/shared/{token}/annotations?from=&to=`
   joins the allowlist of ADR 0060, because a note explains the aggregate charts the link
   already shows. The owner wrote the text and chose to share the project, so a note is as
   public as the link; it takes the range only, no visit filters.
5. **A project keeps at most 1,000 notes**, counted under a lock on the project row, and they go
   with the project. Nothing else deletes them: unlike events, they hold no visitor data.
6. **Logs carry ids only.** Creating a note logs the project and the note's id, never its text.

## Open decision: writing a note with a token

Decision D65 asks for notes written by token (a deploy pipeline marking each release), and D66
keeps that on Pro (`annotations_by_token`). The access tokens of ADR 0015 are read-only by
design and cover every project of the admin who made them; giving them a write is a security
change, so it is not made here. The options:

- **A. The project's secret key (`pyxis_sk_`), on a new `POST /v1/annotations`.** One project
  per key, already held by the site's backend and already allowed to write (erasure, exports);
  a CI job that deploys the site usually has it. Gated by `requireProFeature`.
- **B. A write scope on access tokens,** chosen when the token is made. One token would write to
  every project its admin owns, a wider reach than a deploy needs.
- **C. A new per-project annotation token,** the narrowest, at the cost of a third kind of
  credential to create, list and revoke.

## Consequences

- The dashboard draws the notes from one call per chart range, and the share page from the same
  answer under the token.
- The MCP server can cite the notes of a range through the existing access tokens.
- Whoever decides the open question adds one route and one guard; the table and the rules here
  do not change.
