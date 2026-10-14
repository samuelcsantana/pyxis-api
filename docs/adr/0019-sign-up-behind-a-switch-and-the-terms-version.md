# 19. Sign-up behind a switch, tied to the version of the terms accepted

Date: 2026-10-14

## Status

Accepted. Builds on [ADR 0016](0016-accounts-own-projects.md) (accounts) and
[ADR 0018](0018-billing-follows-stripe-through-its-webhook.md) (billing).

## Context

Until now an admin existed only after the operator granted a project from the command line. The
hosted plan needs anyone to be able to create an account, accept the terms and subscribe, but it
cannot open before the terms are reviewed and published and Stripe is live. Sign-up also creates
people and sends e-mails on demand, so it is an abuse target, and the e-mail provider's daily quota
is shared with the sign-in codes of every product.

## Decision

- **Two settings open it, and both are needed:** `SIGNUP_OPEN=true` and a `TERMS_VERSION`. With
  either missing every sign-up route answers `404 sign_up_closed`, and so does Checkout.
  `GET /v1/auth/sign-up` tells the dashboard whether it is open and which version of the terms to
  show, so the dashboard has no switch of its own to forget.
- **A sign-up code is a sign-in code with another purpose.** It lives in `otp_codes` with
  `purpose = 'sign_up'`, under the same expiry, attempt limit and per-address limit (the hourly
  count covers both purposes). A sign-in code never completes a sign-up and the other way round. On
  top of that, at most 50 sign-up codes go out per day, whoever asks, so a flood cannot use up the
  e-mail quota that sign-in needs.
- **The request answers 202 for any address**, as sign-in does, and the e-mail says nothing is
  created without the code, so the route reveals nothing about who already has an account.
- **The acceptance names the version.** Completing sign-up sends the terms version the page showed;
  if it is not the current one the answer is `409 terms_outdated` and the code stays usable.
  Every acceptance is a row in `terms_acceptances` (admin, account, version, time), deleted with
  its account.
- **Completing sign-up creates an `incomplete` account and a session.** An owner who already has a
  live account gets that one back instead of a second; the account becomes `trialing` only when
  Stripe's webhook says so. Checkout is offered while the account is `incomplete` or `ended`, with
  the 14-day trial only to an account Stripe has never seen.
- **Checkout and the portal are writes from the dashboard:** they need the dashboard's origin and a
  session, and only the owner reaches them; anyone else is told the account does not exist.

## Consequences

- Turning sign-up on or off needs no new image: change `SIGNUP_OPEN` or `TERMS_VERSION` and let
  the function start fresh containers, which read the parameters at cold start. Accounts already
  created keep working either way.
- Publishing a new version of the terms is the same change: the dashboard reads the version from
  the API, and a page left open with the old one is refused instead of recording an acceptance of
  text the person did not see.
- `incomplete` accounts left without a subscription are cleaned up by the daily job (next step).
