import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleDemoTrafficRepository } from '../../src/infra/repositories/drizzle-demo-traffic.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const DEMO_ID = '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d01';
const QUIET_ID = '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d02';
const PLAIN_ID = '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d03';
const SESSION_ID = '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d10';

describe('DrizzleDemoTrafficRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let repository: DrizzleDemoTrafficRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    repository = new DrizzleDemoTrafficRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone) VALUES
        (${DEMO_ID}, 'Demo store', 'America/New_York'),
        (${QUIET_ID}, 'Quiet demo', 'UTC'),
        (${PLAIN_ID}, 'Plain', 'UTC')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function addEvent(projectId: string, id: string, occurredAt: string): Promise<void> {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
        device_type, browser, os)
      VALUES (${id}, ${projectId}, ${occurredAt}, ${occurredAt}, 'page_view', ${SESSION_ID}, '/',
        'desktop', 'chrome', 'windows')
    `;
  }

  it('reads a project, unmarked by default, and nothing for an unknown id', async () => {
    expect(await repository.projectOf(DEMO_ID)).toEqual({
      projectId: DEMO_ID,
      projectName: 'Demo store',
      accountId: null,
      demoTraffic: false,
    });
    expect(await repository.projectOf('6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d99')).toBeNull();
    expect(await repository.mark('6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d99', true)).toBeNull();
  });

  it('lists the marked projects with the moment of their latest event', async () => {
    await repository.mark(DEMO_ID, true);
    await repository.mark(QUIET_ID, true);
    await addEvent(DEMO_ID, '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d21', '2026-10-18T10:00:00Z');
    await addEvent(DEMO_ID, '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d22', '2026-10-19T05:30:00Z');
    await addEvent(PLAIN_ID, '6b7c8d9e-2f3a-4b4c-9d5e-6f7a8b9c0d23', '2026-10-19T09:00:00Z');

    const targets = await repository.targets();

    expect(targets).toEqual([
      {
        projectId: DEMO_ID,
        timezone: 'America/New_York',
        lastEventAt: new Date('2026-10-19T05:30:00Z'),
      },
      { projectId: QUIET_ID, timezone: 'UTC', lastEventAt: null },
    ]);
  });

  it('stops listing a project once it is unmarked', async () => {
    await repository.mark(DEMO_ID, true);

    const unmarked = await repository.mark(DEMO_ID, false);

    expect(unmarked?.demoTraffic).toBe(false);
    expect(await repository.targets()).toEqual([]);
  });
});
