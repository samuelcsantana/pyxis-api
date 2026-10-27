import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFreeAccountInactivityRepository } from '../../src/infra/repositories/drizzle-free-account-inactivity.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const CREATED_AT = new Date('2026-11-01T12:00:00.000Z');
const FREE_SINCE = new Date('2026-12-01T12:00:00.000Z');
const OLDER_EVENT = new Date('2026-12-05T10:00:00.000Z');
const NEWER_EVENT = new Date('2026-12-20T10:00:00.000Z');
const NOTIFIED_AT = new Date('2027-01-05T06:00:00.000Z');
const ANA = 'd1d2d3d4-0000-4000-8000-000000000001';
const BIA = 'd1d2d3d4-0000-4000-8000-000000000002';
const CAI = 'd1d2d3d4-0000-4000-8000-000000000003';
const DAN = 'd1d2d3d4-0000-4000-8000-000000000004';
const MEASURED = 'd1d2d3d4-0000-4000-8000-000000000011';
const EMPTY = 'd1d2d3d4-0000-4000-8000-000000000012';
const HELD = 'd1d2d3d4-0000-4000-8000-000000000013';
const SUSPENDED = 'd1d2d3d4-0000-4000-8000-000000000014';
const PAID = 'd1d2d3d4-0000-4000-8000-000000000015';
const SHOP = 'd1d2d3d4-0000-4000-8000-000000000021';
const BLOG = 'd1d2d3d4-0000-4000-8000-000000000022';

describe('free accounts and their last stored event, against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let inactivity: DrizzleFreeAccountInactivityRepository;

  const storeEvent = async (projectId: string, receivedAt: Date): Promise<void> => {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os)
      VALUES (gen_random_uuid(), ${projectId}, ${receivedAt}, ${receivedAt}, 'page_view',
              gen_random_uuid(), '/', 'desktop', 'chrome', 'windows')
    `;
  };

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    inactivity = new DrizzleFreeAccountInactivityRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'pt-BR'), (${BIA}, 'bia@example.com', 'en'),
             (${CAI}, 'cai@example.com', 'en'), (${DAN}, 'dan@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, created_at, free_since,
                            inactivity_notified_at, deletion_held_at, suspended_at)
      VALUES (${MEASURED}, ${ANA}, 'free', ${CREATED_AT}, ${FREE_SINCE}, ${NOTIFIED_AT}, NULL, NULL),
             (${EMPTY}, ${BIA}, 'free', ${CREATED_AT}, NULL, NULL, NULL, NULL),
             (${HELD}, ${CAI}, 'ended', ${CREATED_AT}, NULL, NULL, ${CREATED_AT}, NULL),
             (${SUSPENDED}, ${DAN}, 'ended', ${CREATED_AT}, NULL, NULL, NULL, ${CREATED_AT}),
             (${PAID}, ${BIA}, 'active', ${CREATED_AT}, NULL, NULL, NULL, NULL)
    `;
    await owner`
      INSERT INTO projects (id, name, account_id) VALUES (${SHOP}, 'Shop', ${MEASURED}),
                                                         (${BLOG}, 'Blog', ${MEASURED})
    `;
    await storeEvent(SHOP, OLDER_EVENT);
    await storeEvent(BLOG, NEWER_EVENT);
    await storeEvent(BLOG, OLDER_EVENT);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists the free accounts with the latest event stored in any of their projects', async () => {
    const free = await inactivity.freeAccounts();

    expect(free.map(({ accountId }) => accountId).sort()).toEqual([MEASURED, EMPTY].sort());
    expect(free.find(({ accountId }) => accountId === MEASURED)).toEqual({
      accountId: MEASURED,
      ownerAdminId: ANA,
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'pt-BR',
      freeSince: FREE_SINCE,
      lastEventAt: NEWER_EVENT,
      inactivityNotifiedAt: NOTIFIED_AT,
    });
  });

  it('gives an account without projects no last event, and its creation while it has no free_since', async () => {
    const free = await inactivity.freeAccounts();

    expect(free.find(({ accountId }) => accountId === EMPTY)).toMatchObject({
      freeSince: CREATED_AT,
      lastEventAt: null,
      inactivityNotifiedAt: null,
    });
  });

  it('leaves out a free account under a deletion hold or suspended', async () => {
    await owner`UPDATE accounts SET status = 'free' WHERE id = ${HELD}`;
    await owner`UPDATE accounts SET status = 'free' WHERE id = ${SUSPENDED}`;

    const free = await inactivity.freeAccounts();

    expect(free.map(({ accountId }) => accountId)).not.toContain(HELD);
    expect(free.map(({ accountId }) => accountId)).not.toContain(SUSPENDED);
  });

  it('marks the notice and clears it', async () => {
    await inactivity.markNotified(EMPTY, NOTIFIED_AT);
    await inactivity.clearNotice(MEASURED);

    const free = await inactivity.freeAccounts();

    expect(free.find(({ accountId }) => accountId === EMPTY)?.inactivityNotifiedAt).toEqual(
      NOTIFIED_AT,
    );
    expect(free.find(({ accountId }) => accountId === MEASURED)?.inactivityNotifiedAt).toBeNull();
  });
});
