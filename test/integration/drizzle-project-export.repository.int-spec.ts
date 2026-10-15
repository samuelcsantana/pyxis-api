import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectExportRepository } from '../../src/infra/repositories/drizzle-project-export.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-11-02T13:00:00.000Z');
const DAY_START = new Date('2026-11-01T13:00:00.000Z');
const OWNER_ID = 'b1b2b3b4-0000-4000-8000-000000000001';
const SHOP_ID = 'b1b2b3b4-0000-4000-8000-000000000011';
const LIMITS = { since: DAY_START, perDay: 2 };

describe('project exports against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let exports: DrizzleProjectExportRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    exports = new DrizzleProjectExportRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language) VALUES (${OWNER_ID}, 'owner@example.com', 'es')
    `;
    await owner`INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop')`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('records a request, as the application role, and answers it while it waits', async () => {
    const first = await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS);
    const again = await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS);

    expect(first).toEqual({
      outcome: 'requested',
      projectExport: {
        id: expect.any(String) as string,
        projectId: SHOP_ID,
        requestedBy: OWNER_ID,
        requestedAt: NOW,
        status: 'pending',
        finishedAt: null,
        objectKey: null,
        eventCount: null,
      },
    });
    expect(again.outcome).toBe('already_pending');
  });

  it('refuses a second waiting export at the database too', async () => {
    await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS);

    await expect(
      owner`
        INSERT INTO project_exports (project_id, requested_at, status)
        VALUES (${SHOP_ID}, ${NOW}, 'pending')
      `,
    ).rejects.toThrow(/project_exports_one_pending_idx/);
  });

  it('counts the requests of the last day against the limit', async () => {
    await owner`
      INSERT INTO project_exports (project_id, requested_at, status)
      VALUES (${SHOP_ID}, '2026-10-30T00:00:00Z', 'done'), (${SHOP_ID}, ${NOW}, 'done'),
             (${SHOP_ID}, ${NOW}, 'failed')
    `;

    expect(await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS)).toEqual({
      outcome: 'daily_limit_reached',
    });
  });

  it('describes a waiting export with its project and requester, then completes it', async () => {
    const request = await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS);
    if (request.outcome !== 'requested') {
      throw new Error(`expected a request, got ${request.outcome}`);
    }
    const exportId = request.projectExport.id;

    expect(await exports.pendingTarget(exportId)).toEqual({
      projectExport: request.projectExport,
      projectName: 'Shop',
      requester: { email: 'owner@example.com', language: 'es' },
    });
    expect(await exports.stalled(new Date(NOW.getTime() + 1))).toEqual([exportId]);
    expect(await exports.stalled(NOW)).toEqual([]);

    await exports.complete(exportId, { objectKey: 'exports/k.csv.gz', eventCount: 42, at: NOW });

    expect(await exports.pendingTarget(exportId)).toBeNull();
    expect(await exports.findOfProject(SHOP_ID, exportId)).toEqual(
      expect.objectContaining({ status: 'done', objectKey: 'exports/k.csv.gz', eventCount: 42 }),
    );
  });

  it('marks a failed export, and keeps an export whose requester was deleted', async () => {
    const request = await exports.request(SHOP_ID, OWNER_ID, NOW, LIMITS);
    if (request.outcome !== 'requested') {
      throw new Error(`expected a request, got ${request.outcome}`);
    }
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;

    expect((await exports.pendingTarget(request.projectExport.id))?.requester).toBeNull();
    await exports.fail(request.projectExport.id, NOW);
    expect(await exports.findOfProject(SHOP_ID, request.projectExport.id)).toEqual(
      expect.objectContaining({ status: 'failed', finishedAt: NOW, requestedBy: null }),
    );
    expect(await exports.findOfProject(SHOP_ID, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('reads the events of the project in pages, in time order, after a cursor', async () => {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      VALUES ('00000000-0000-4000-8000-000000000003', ${SHOP_ID}, '2026-10-01T00:00:02Z', ${NOW},
              'page_view', '00000000-0000-4000-8000-0000000000aa', '/b', 'desktop', 'chrome',
              'windows', '{"plan":"yearly"}'),
             ('00000000-0000-4000-8000-000000000001', ${SHOP_ID}, '2026-10-01T00:00:01Z', ${NOW},
              'page_view', '00000000-0000-4000-8000-0000000000aa', '/a', 'desktop', 'chrome',
              'windows', '{}'),
             ('00000000-0000-4000-8000-000000000002', ${SHOP_ID}, '2026-10-01T00:00:01Z', ${NOW},
              'signup', '00000000-0000-4000-8000-0000000000aa', '/a', 'mobile', 'safari', 'ios', '{}')
    `;

    const first = await exports.page(SHOP_ID, null, 2);
    const last = first.at(-1);
    if (last === undefined) {
      throw new Error('expected a first page');
    }
    const second = await exports.page(SHOP_ID, { occurredAt: last.occurredAt, id: last.id }, 2);

    expect(first.map(({ path, name }) => `${path} ${name}`)).toEqual(['/a page_view', '/a signup']);
    expect(second).toEqual([
      expect.objectContaining({ path: '/b', properties: { plan: 'yearly' }, fromAdClick: false }),
    ]);
  });
});
