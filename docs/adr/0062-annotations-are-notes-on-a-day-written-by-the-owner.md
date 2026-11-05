# 62. Annotations are notes on a day, written by the owner

Date: 2026-11-05

## Status

Accepted. Writing a note with a token was decided on 2026-11-05, after the first version of this
record left it open: the project's secret key (point 7). Builds on [ADR 0015](0015-read-only-access-tokens-for-agents.md) (access tokens
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

7. **A deploy or a script writes a note with the project's secret key, on Pro.**
   `POST /v1/annotations` with `Authorization: Bearer pyxis_sk_…` and the same `{ day, text }`
   writes on the key's own project: the body names no project, so a key can only ever write
   where it belongs, and a body that tries to name one is refused like any unknown field. It
   takes the dashboard's rules (day, length, the 1,000 limit, the same `annotation.created` log),
   the same guards and rate limits as the other secret-key routes (per address, then per key),
   and `requireProFeature(account, 'annotations_by_token')` after the access checks: the free
   plan answers `403 plan_required`. The access tokens stay read-only.

   Decision D65 asked for notes written by token, and D66 kept that on Pro. Three credentials
   were weighed:
   - **A, chosen: the project's secret key.** One project per key; it is already held by the
     site's backend and already writes (a person's erasure and export); a CI job that deploys
     the site usually has it, so marking a release needs no new credential.
   - **B, a write scope on access tokens.** An access token covers every project its admin
     owns, wider than a deploy needs, and ADR 0015 promises it never writes.
   - **C, a new per-project annotation token.** The narrowest, at the cost of a third kind of
     credential to create, list and revoke, for a note no more sensitive than what the secret
     key already does.

## Consequences

- The dashboard draws the notes from one call per chart range, and the share page from the same
  answer under the token.
- The MCP server can cite the notes of a range through the existing access tokens.
- A deploy marks its release with one `curl` and the secret key it already has; revoking that
  key in the dashboard stops it, as it stops erasure and export with it.
