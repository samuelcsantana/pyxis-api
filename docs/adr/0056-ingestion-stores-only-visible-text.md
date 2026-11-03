# 56. Ingestion stores only visible text

Date: 2026-11-03

## Status

Accepted.

## Context

An event carries four kinds of free text that no pattern constrains: the path, the route of an
`api_request`, the campaign tags and the text properties. Anyone holding a project's public key can
send any string in them, and three problems followed from that:

1. **One character lost a whole batch.** Postgres cannot store U+0000 in `text` or `jsonb`, nor a
   lone surrogate in `jsonb`. The batch is stored with one multi-row `INSERT`, so an event carrying
   either made the insert fail and the API answer 500. Every valid event of the batch was lost, and
   the tracker, which retries a 5xx, sent it five more times before dropping it. That broke ADR
   0005: one bad event must never cost the rest of its batch.
2. **Text a person cannot see reached the reports.** Zero-width spaces, bidirectional overrides and
   the tag characters U+E0020–U+E007F (which spell ASCII invisibly) passed validation. A property
   shown as "pro" in the dashboard could carry a sentence that only a language model reads when an
   agent queries the project through the MCP server.
3. **The personal-data barrier could be walked around.** A phone number split by zero-width spaces
   no longer looked like a phone number to the barrier, and was stored.

Two ways to handle such characters were weighed. **Rejecting the event** keeps the stored data
exactly as sent, but loses events that are not hostile at all: translation libraries such as Fluent
wrap every variable in invisible isolate marks, and text copied from a page carries soft hyphens
and byte-order marks. **Removing the characters** keeps those events and stores what a person sees.

## Decision

- Before anything else judges them, the path, the route, the campaign tags and the text properties
  lose every character of the Unicode categories Cc (control), Cf (format) and Cs (surrogate),
  except tab, line feed and carriage return, which are visible as spacing, and the zero-width
  non-joiner and joiner (U+200C, U+200D), which emoji sequences and scripts such as Persian and
  Devanagari need to render correctly.
- The path and the route are templated, and every value goes through the personal-data barrier,
  only after that, so the barrier judges the text a person would read.
- A campaign tag left with no visible text is dropped like a tag that looks personal, with the
  reason `no_visible_text`. A text property left empty is kept empty, as an empty property already
  was.
- The event's name, keys, user id, referrer host and error code are already limited to ASCII
  patterns and are not touched.

## Consequences

- A batch is never lost to a character Postgres cannot hold; the regression test sends U+0000 and
  a lone surrogate among valid events and expects every event stored.
- What the dashboard shows and what an agent reads through the MCP server are the same text. This
  removes the hiding, not the injection: anyone with a public key can still send visible text, so
  agents must keep treating what a tool returns as data.
- Flags drawn with tag characters (England, Scotland, Wales) are stored as a plain black flag.
- Production held no value with any of these characters on the day of the change, so nothing
  stored before it had to be rewritten.
