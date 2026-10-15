# 24. Exports are files that live a week, reached through links signed on demand

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0022](0022-an-account-ends-in-steps.md) (the end of an account).

## Context

The terms promise that an owner can take their data out, in particular during the thirty days
between the end of a subscription and the deletion. A project of the hosted plan can hold a
million events, far more than an HTTP answer or the HTTP function's thirty seconds can carry, and
the file contains user ids, so it must not sit behind a public or long-lived link.

## Decision

- **An export is a request first.** `POST /v1/projects/{projectId}/exports`, the owner only, in any
  account state, records it (`project_exports`) and answers 202. One export waits at a time per
  project (a partial unique index) and three may be asked for a day.
- **The jobs function writes the file.** The HTTP function invokes it asynchronously with the
  export's id; the daily job runs any export left waiting more than fifteen minutes, so a failed
  invocation is not lost. Events are read in pages of 5,000 by `(occurred_at, id)`, written as CSV
  (RFC 4180, a guard against spreadsheet formulas, properties as JSON) through gzip, and stored
  as one object.
- **The file lives a week**, enforced by the bucket's lifecycle rule, not by the code.
- **The e-mail links to the dashboard, not to the file.** A presigned S3 link made with a Lambda
  role's temporary credentials stops working when that session expires, within hours, so it
  cannot be the seven-day link in an e-mail. The dashboard's export page asks
  `GET /v1/projects/{projectId}/exports/{exportId}` with the owner's session, which signs a link
  for five minutes. The link in the mailbox is not a secret; the session is.

## Consequences

- An owner downloads only while signed in, from the dashboard, within the week.
- A forwarded e-mail gives nothing away.
- The bucket and the permissions are in Terraform; the Terraform role needs the `ExportsBucket`
  statement before the first apply.
