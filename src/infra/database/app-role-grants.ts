import { POSTGRES_ROLE_NAME } from '../../config/env.schema';

export function appRoleGrantStatements(role: string): string[] {
  if (!POSTGRES_ROLE_NAME.test(role)) {
    throw new Error(`Invalid APP_DB_ROLE "${role}": expected a lower-case Postgres identifier.`);
  }
  return [
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    `REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ${role}`,
    `REVOKE CREATE ON SCHEMA public FROM ${role}`,
  ];
}
