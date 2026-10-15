# 23. The welcome follows the subscription, with the daily job as a fallback

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0019](0019-sign-up-behind-a-switch-and-the-terms-version.md) (sign-up)
and [ADR 0022](0022-an-account-ends-in-steps.md) (the end of an account).

## Context

Brazilian consumer law for online sales (Decreto 7.962/2013) asks the seller to confirm the
contract right after it is accepted and to make its terms available. Stripe sends its own
receipts, but nothing from Pyxis says the subscription started, until when the trial runs, what to
do next, or which terms were accepted.

## Decision

- **The webhook sends the welcome** when an account moves from no access (a sign-up waiting for
  Checkout, or an account that had ended) to access. It is best effort: an error is logged and the
  webhook still completes.
- **The daily job sends it to any account still waiting**: with access, never welcomed
  (`welcomed_at`), and with a recorded acceptance of the terms. Accounts linked by hand from the
  payment links of the invitation phase have no acceptance and get none.
- **The terms in the e-mail are the version the owner accepted** (the latest acceptance of the
  account) and the address in `TERMS_URL`. `TERMS_URL` becomes a condition to open sign-up, and
  `GET /v1/auth/sign-up` answers it, so the sign-up page and the e-mail link to the same place.
- The trial end is mentioned only while the account is trialing.

## Consequences

- An owner is welcomed once per account; returning after an end through a new Checkout sends it
  again only if the account had not been welcomed before.
- Opening sign-up now needs three settings: `SIGNUP_OPEN`, `TERMS_VERSION` and `TERMS_URL`.
