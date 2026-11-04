# 57. Pro features are gated by the account status

Date: 2026-11-04

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts),
[ADR 0036](0036-a-larger-plan-is-limits-on-the-account.md) (limits on the account) and
[ADR 0048](0048-a-free-plan-is-a-status-with-its-own-limits.md) (the free plan as a status). The
paid plan's numbers in those records (100,000 events, 3 projects, 3 people) were the numbers of
their day; from this change the paid plan's base is 250,000 events, 10 projects and 10 people.

## Context

Until now both plans had every feature and differed only in their limits: the free plan (named
Hobby to customers) holds 10,000 events, 1 project and 1 person, the paid plan (Pro) more of each.
The next features are integrations and work shared with other people: a public read-only link to
a project's figures, alerts sent to Slack, annotations created with an access token, importing the
Google Analytics 4 history and reading Google Search Console. These are kept for Pro, while every
analytics screen, goals, e-mail alerts, annotations made in the dashboard, the Claude connector and
the existing access tokens stay in both plans.

Each of those features will be built in its own change, in a different part of the API. Without
one shared rule each would decide again what "on Pro" means, and they could disagree about a
gifted account, an account in its trial or one whose subscription is ending.

## Decision

1. **One plan predicate, shared by limits and features.** `isOnFreePlan(status)` and
   `isOnProPlan(status)` live beside `hasAccess` in `account-status.ts`. The effective limits read
   `isOnFreePlan` to choose their base, and the feature gate reads `isOnProPlan`, so an account
   with access and Pro limits is the account with Pro features.
2. **Pro is every status with access except `free`:** `trialing`, `active`, `past_due`, `ending`
   and `comped`. A trial is a trial of Pro, so it tries the Pro features. `past_due` keeps them
   while Stripe retries the card, as it keeps access. `ending` keeps them until the paid period it
   already paid for ends. `comped` is the operator's gift of the paid plan. `incomplete` and
   `ended` have no access at all, so they are on no plan.
3. **A closed list of feature names**, `PRO_FEATURES`: `public_share_link`, `slack_alerts`,
   `annotations_by_token`, `ga4_import`, `search_console`. A new Pro feature is added to the list,
   so the name the API answers with is never free text.
4. **`requireProFeature(account, feature)`** throws `PlanRequiredError`, code `plan_required`,
   carrying the feature's name. The HTTP filter answers it with **403**: the request is
   understood and the caller is authenticated, but the account's plan does not allow it.
   `409` is what the API uses when the account's current state blocks an action it could take
   later by itself (a limit reached, an account ending), and `402 Payment Required` is reserved
   by HTTP for future use and handled inconsistently by clients. The dashboard keys on the
   `plan_required` code to show its "Available on Pro" offer, not on the status.
5. **Evaluated on each use, from the status, with nothing stored.** No column records that an
   account "has" a feature. An account that leaves Pro loses the use at its next request and
   keeps its data: a public link stops opening, Slack stops receiving, an import cannot start,
   and what was already imported or configured stays until the owner removes it or the account
   ends by the usual path. An account that comes back to Pro finds it all again.
6. **The operator's limits grant no feature.** A larger plan given with `account:limits` changes
   numbers, not the plan; a free account with more events is still on the free plan.
7. **A project outside any account** (the operator's own, which has no plan and no quota since
   ADR 0016) may use every Pro feature.

## Consequences

- Each later feature calls `requireProFeature` once, where it starts the action (creating a share
  link, sending to Slack, accepting an annotation by token, starting an import), and needs no
  test of its own for which statuses pass: the gate's tests decide that for all of them.
- The gate ships before any caller, so the first feature to use it adds only the call.
- Moving a feature between plans is one change to the list and the call sites, never a migration.
- A refused request names the feature, so the dashboard and the MCP tools can say which plan it
  needs without a second lookup.
