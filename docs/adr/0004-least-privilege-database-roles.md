# 4. Least-privilege database roles

Date: 2026-10-05

## Status

Accepted

## Context

The API is reachable from the internet and holds analytics for every project it measures. If the
process were ever compromised, a connection with schema rights could drop tables, add triggers or
truncate the event history in one statement.

## Decision

Two roles, two connection strings:

- **The owner** (`pyxis` locally) owns the schema. Only the migration step connects with it, through
  `MIGRATION_DATABASE_URL`, and nothing else ever receives that URL.
- **The application role** (`APP_DB_ROLE`, `pyxis_app` locally) is what the API connects as,
  through `DATABASE_URL`. After every migration the owner grants it usage of the public schema,
  select, insert, update and delete on every table and usage of the sequences, and revokes
  truncate, references, triggers and create.
- At boot the API checks which role it connected as and logs a warning if that role can create
  objects in the public schema.

Grants run after each migration instead of relying on default privileges, so a table created by a
later migration is covered the same way, and the statements stay visible in one place
(`src/infra/database/app-role-grants.ts`). The role name is validated as a plain identifier before
it is interpolated into SQL.

## Consequences

- A compromise of the API process can still read and change rows, but cannot change the schema or
  wipe a table in one statement.
- Deployments need both URLs: the migration function gets the owner's, the HTTP and job functions
  get the application role's.
- Integration tests prove the boundary: the application role reads and writes rows and is refused
  `CREATE TABLE`, `TRUNCATE` and `DROP TABLE`.
