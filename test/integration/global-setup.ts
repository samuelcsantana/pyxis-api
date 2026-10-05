import postgres from 'postgres';
import { POSTGRES_ROLE_NAME } from '../../src/config/env.schema';
import { appRole, appUrl, ownerUrl } from '../local-database';
import { MIGRATION_PROBE_DATABASE, TEST_DATABASE } from './test-database';

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export default async function globalSetup(): Promise<void> {
  const role = appRole();
  if (!POSTGRES_ROLE_NAME.test(role)) {
    throw new Error(`Invalid application role "${role}" for the integration tests.`);
  }
  const password = decodeURIComponent(new URL(appUrl()).password);
  const admin = postgres(ownerUrl(), { max: 1, onnotice: () => undefined });
  try {
    const [row] = await admin<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists
    `;
    if (row?.exists !== true) {
      await admin.unsafe(`CREATE ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)}`);
    }
    for (const database of [TEST_DATABASE, MIGRATION_PROBE_DATABASE]) {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.unsafe(`CREATE DATABASE ${database}`);
    }
  } finally {
    await admin.end();
  }
}
