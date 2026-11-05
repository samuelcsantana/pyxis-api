# 61. E-mail alerts from the daily run

Date: 2026-11-05

## Status

Accepted. Builds on [ADR 0011](0011-weekly-digest-from-the-jobs-function.md) (the weekly digest,
whose recipients, preference and delivery record these alerts copy),
[ADR 0057](0057-pro-features-are-gated-by-the-account-status.md) (alerts by e-mail are in both
plans; only Slack will be Pro) and [ADR 0058](0058-goals-replace-the-conversion-event.md) (the
first goal is the conversion).

## Context

The weekly digest shows a broken install or a failing route up to a week late. Three problems
are worth hearing about the next morning: the site stopped sending events, its writes started
failing, and its main conversion fell. Alerts are noise when they fire on small numbers, and a
product that promises privacy cannot become a source of e-mail its users did not want.

## Decision

1. **Three alerts, judged once a day in the existing daily run** (06:00 UTC), after the operator
   notices and before the project icons, best effort like the icons: a failure is logged as
   `jobs.alerts_failed` and the rest of the run still reports. No new schedule: a 24-hour rule
   checked daily is at most a day late, and an hourly schedule would wake the database every
   hour for an alert that changes nothing within the day.
2. **The day judged is the last closed day in the project's time zone** (`alertDays`), so every
   number matches what the dashboard shows for "yesterday".
   - **No events:** the newest event is 24 hours old or more (`SILENCE_MS`), and the project had
     at least 20 visits (`MIN_VISITS_BEFORE_SILENCE`) in the seven days ending yesterday. The
     history window moves with the days, so a site that stays down is alerted for about a week
     and then left alone; a project that never received an event is never alerted.
   - **Failed writes:** yesterday at least 10 writes failed (`MIN_FAILED_WRITES`), they were at
     least 10% of the writes (`MIN_FAILURE_RATE`), and that rate is at least twice
     (`FAILURE_SPIKE_FACTOR`) the rate of the seven days before. A site that always fails this
     much is not alerted every day; one that starts failing is.
   - **Conversion drop:** the first goal was reached yesterday at most half as often
     (`CONVERSION_DROP_SHARE`) as on the same weekday a week earlier, which had at least 10
     (`MIN_COMPARED_CONVERSIONS`). The same weekday absorbs the weekly rhythm of most sites;
     below 10 a drop by half is chance. A project without a goal has no such alert.
     The numbers come from the dashboard's own queries (the Overview totals and the project
     activity), never from a second definition of a visit, a write or a conversion.
3. **At most once a day per kind, project and person.** `alert_deliveries` keeps one row per
   project, person, kind and UTC day of the run, written only after the e-mail left; running the
   daily job again the same day sends nothing twice. An e-mail that fails is logged
   (`alerts.delivery_failed`) and never stops the others; a project whose numbers cannot be read
   is logged (`alerts.detection_failed`) and the next project is judged.
4. **Who receives them:** every person of the project who keeps that alert on, each in the
   language of their last sign-in, like the digest. Nothing is judged for an account without
   access (`incomplete`, `ended`), a suspended account or project, or an account whose ingestion
   is paused by its quota: their silence is expected. Both plans receive them.
5. **On by default, one switch per alert and person.** `admin_project_access` gains
   `no_events_alert`, `failed_writes_alert` and `conversion_drop_alert`, default `true`, next to
   `weekly_digest`, and `GET`/`PUT /v1/projects/{projectId}/email-preferences` answer and change
   them; a `PUT` changes only the fields it sends, so the dashboard already deployed, which sends
   only `weekly_digest`, keeps working.
   On by default because an alert one must remember to turn on before the outage it reports
   catches nothing, and these fire rarely: the thresholds keep small sites quiet, each kind
   comes at most once a day, and they are about the reader's own site, like the digest that is
   also on by default. Every alert says why it arrived and links to the switch that stops it,
   in Settings.
6. **No personal data:** an alert carries the project's name, a time, counts, a rate and the
   goal's name. Logs name projects and people by id, never by address.

## Consequences

- The thresholds are named constants in `src/domain/alerts/alert-rules.ts`, each tested on both
  sides; changing one is one change and its tests.
- Existing accesses start with every alert on when the migration runs (`DEFAULT true`).
- The Slack alerts (Pro) will reuse the same detection and the same once-a-day record with a
  second channel; the e-mail stays in both plans.
- An outage shorter than a day between two runs, or a drop within a day, is not reported; the
  dashboard and the weekly digest still show it.
