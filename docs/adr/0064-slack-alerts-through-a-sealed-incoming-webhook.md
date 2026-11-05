# 64. Slack alerts through a sealed Incoming Webhook

Date: 2026-11-05

## Status

Accepted. Builds on [ADR 0061](0061-email-alerts-from-the-daily-run.md) (the three alerts and the
daily run that judges them) and [ADR 0057](0057-pro-features-are-gated-by-the-account-status.md)
(`slack_alerts` is a Pro feature).

## Context

Teams read alerts where they already talk. The simplest way into a Slack channel is an Incoming
Webhook: the customer creates one in their workspace and pastes its address; Pyxis never holds a
Slack token, a bot or an OAuth grant. But the address is a bearer secret (anyone with it can
post to that channel), and a feature that lets a customer make the server call an address they
typed is a classic server-side request forgery path.

## Decision

1. **Only Slack Incoming Webhooks.** The address must match
   `https://hooks.slack.com/services/<TEAM>/<CHANNEL>/<secret>` exactly
   (`SLACK_WEBHOOK_PATTERN`, at most 256 characters): HTTPS, that host, no port, no credentials,
   no query or fragment, no other path. There are no generic webhooks. Sending checks the pattern
   again, refuses redirects (`redirect: 'error'`) and gives up after 10 seconds, so the server
   only ever calls Slack, whatever was stored.
2. **Sealed at rest with AES-256-GCM, from Node's own `crypto`** (no dependency). Each value gets
   a random 12-byte IV, a 16-byte tag and the project as additional data
   (`slack-webhook:<projectId>`), so a value copied to another project's row does not open. The
   stored form is `v<key version>.<iv>.<tag>.<ciphertext>`. The keys come from
   `SLACK_WEBHOOK_KEYS`, `version:base64-key[,version:base64-key]`: the newest version seals,
   every listed version opens, so a key rotates by adding the next version and keeping the old
   ones until every value was saved again. In AWS the value is a SecureString under the
   `/app` and `/jobs` prefixes the two functions already read at cold start; locally and in CI it
   is an environment variable, and tests use their own keys. With no keys, or keys that do not
   parse (the placeholder Terraform writes), the server stays up, logs `secret_box.keys_invalid`
   without the value, and the Slack routes answer `503 slack_unavailable`: nothing is ever stored
   in the clear.
3. **Never answered back, never logged.** The routes answer `hooks.slack.com/…/` and the last
   four characters, kept in their own column; logs name the project only.
4. **Owner only, Pro to connect or test, any plan to see or remove.**
   `GET/PUT/DELETE /v1/projects/{projectId}/slack-webhook` and `POST …/slack-webhook/test`. Setting
   and testing need the project's owner and `requireProFeature(account, 'slack_alerts')`; reading
   the masked value and removing it work on any plan, so an account that left Pro keeps the
   stored value, sees it and can remove it at any time. The test posts a fixed sentence in the
   admin's language and is limited to ten per address every fifteen minutes (`slack-test`).
5. **Posted by the daily run, after the e-mails, best effort.** `SendSlackAlertsUseCase` judges
   every working webhook's project with the same `DetectProjectAlertsUseCase` and the same
   eligibility as the e-mails (`mayAlert`), plus Pro, and posts each raised alert once per
   project, kind and UTC day (`slack_alert_deliveries`), in the language of the account owner.
   All three kinds go to the channel: the per-person switches of ADR 0061 are about a person's
   inbox, and a channel is the owner's choice as a whole. A failed post is logged and tried
   again the next day; a project that cannot be judged or opened is logged and the next one
   goes on; the whole step failing is logged as `jobs.slack_alerts_failed` and the run still
   reports.
6. **A webhook Slack says is gone is marked broken, not retried.** A 404 or 410 (Slack's
   `no_service`, `channel_not_found`, `channel_is_archived`) sets `broken_at` and
   `broken_reason`, visible to the owner; the daily run skips broken webhooks, and the run stops
   posting to it at once. Saving an address again clears the mark.

## Consequences

- A leaked database dump does not leak channels: the addresses need a key that lives only in
  Parameter Store.
- Removing a key version makes every value sealed with it unreadable until its owner pastes the
  address again; rotation only ever adds a version.
- The project's alerts are judged twice in the daily run (once for e-mail, once for Slack). The
  queries are the Overview's own and the run is daily; merging the two would couple the e-mail
  and Slack schedules for no measurable gain.
- Going live needs two steps outside the code, in order: `terraform apply` (the two SecureString
  parameters, with a placeholder) and the script that writes a fresh key to both without
  printing it. Until then the routes answer `slack_unavailable`.
