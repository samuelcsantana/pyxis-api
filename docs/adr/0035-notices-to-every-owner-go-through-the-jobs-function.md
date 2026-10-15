# 35. Notices to every owner are stored, then sent by the jobs function

Date: 2026-10-15

## Status

Accepted.

## Context

The terms promise e-mails to every customer: 30 days before a change of prices or terms, before a
new subprocessor, after an outage longer than a day. Sending them meant a script that read every
owner's address and sent one e-mail each, from the operator's machine, with no record of who got
it and no way to resume after a failure halfway.

## Decision

1. **The operator stores the notice, the service sends it.** `notice:create` reads one plain text
   file per language (a subject line, then paragraphs), refuses a missing or oversized one, and
   writes the notice (`notices`, its campaign name used once) with one pending delivery per account
   (`notice_deliveries`). `--dry-run` only counts the owners of each language.
2. **The audience is the accounts with access** (`trialing`, `active`, `past_due`, `ending`,
   `comped`); `--include-ended` adds the ended ones not yet deleted. Sign-ups that never subscribed
   are left out.
3. **The jobs function sends**, through the same mail sender as every other e-mail, in the owner's
   language, with replies to `SUPPORT_EMAIL`, marking each delivery as it goes. It sends on every
   daily run and when invoked with `{"job":"account-notices"}`, up to 500 a run; a failed e-mail
   is logged (`notices.delivery_failed`, counted by the account e-mail alarm) and stays pending.
4. **Plain text only.** The text is escaped into the e-mail layout; nothing is interpreted as HTML
   or Markdown, so a notice cannot carry markup or links the operator did not see.
5. **Deliveries go with their account**, by cascade; the notice itself stays, as the record of
   what was said and when.

## Consequences

- No address leaves the database for the operator's machine, and a notice is never sent twice.
- A notice reaches the owner of each account, not every person with access to its projects.
- Sending takes one more step (the invocation or the next daily run) after storing the notice.
