import postgres from 'postgres';
import { applyMigrations } from '../../src/infra/database/migrations';
import { createPostgresMigrationTarget } from '../../src/infra/database/postgres-migration-target';
import { appRole, ownerUrl } from '../local-database';
import { E2E_DATABASE, e2eOwnerUrl } from './e2e-database';

export default async function globalSetup(): Promise<void> {
  const admin = postgres(ownerUrl(), { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${E2E_DATABASE}`);
  } finally {
    await admin.end();
  }
  await applyMigrations(createPostgresMigrationTarget(e2eOwnerUrl()), appRole());
}
