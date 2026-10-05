# Security policy

## Supported versions

Only the latest release and `main` receive security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/samuelcsantana/pyxis-api/security/advisories/new).
Do not open a public issue.

Include what you found, how to reproduce it and the impact you expect. You will get an
acknowledgement within a few days, and the fix will be credited to you if you wish.

## Scope

Of particular interest:

- abuse of the public ingestion endpoint (bypassing the origin check, the rate limits or the batch
  limits);
- reading or erasing data of a project you have no access to;
- dashboard session handling (fixation, theft, cross-site requests);
- personal data that reaches storage or logs despite the PII barrier;
- secrets exposed by the repository, the build or the infrastructure code.
