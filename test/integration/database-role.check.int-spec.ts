import { Logger } from '@nestjs/common';
import { DatabaseRoleCheck } from '../../src/infra/database/database-role.check';
import { createDrizzleDatabase } from '../../src/infra/database/postgres-client';
import postgres from 'postgres';
import { testAppUrl, testOwnerUrl } from './test-database';

async function runCheckAs(url: string): Promise<{ logs: string[]; warnings: string[] }> {
  const logs: string[] = [];
  const warnings: string[] = [];
  jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
    logs.push(String(message));
  });
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnings.push(String(message));
  });
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await new DatabaseRoleCheck(createDrizzleDatabase(client)).tryReportDatabaseRole();
  } finally {
    await client.end();
    jest.restoreAllMocks();
  }
  return { logs, warnings };
}

describe('DatabaseRoleCheck against a real Postgres', () => {
  it('reports the application role as ok', async () => {
    const { logs, warnings } = await runCheckAs(testAppUrl());

    expect(logs).toEqual([expect.stringContaining('database.role_ok')]);
    expect(warnings).toEqual([]);
  });

  it('warns when the API would connect as the owner', async () => {
    const { warnings } = await runCheckAs(testOwnerUrl());

    expect(warnings).toEqual([expect.stringContaining('database.role_can_create')]);
  });
});
