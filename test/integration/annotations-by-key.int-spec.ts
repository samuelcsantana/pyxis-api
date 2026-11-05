import type postgres from 'postgres';
import { PlanRequiredError } from '../../src/domain/errors/account.errors';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountRepository } from '../../src/infra/repositories/drizzle-account.repository';
import { DrizzleAnnotationRepository } from '../../src/infra/repositories/drizzle-annotation.repository';
import { DrizzleProjectSettingsRepository } from '../../src/infra/repositories/drizzle-project-settings.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { CreateAnnotationByKeyUseCase } from '../../src/usecases/annotations/create-annotation-by-key.usecase';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-11-05T02:00:00.000Z');
const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const ACCOUNT_ID = 'c5f3e4d6-7d80-4192-a314-c5d6e7f8091a';
const OWNER_ID = 'd6a4f5e7-8e91-42a3-b425-d6e7f8091a2b';

describe('annotations written with a secret key, against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let create: CreateAnnotationByKeyUseCase;
  let annotations: DrizzleAnnotationRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    annotations = new DrizzleAnnotationRepository(db);
    create = new CreateAnnotationByKeyUseCase(
      new DrizzleProjectSettingsRepository(db),
      new DrizzleAccountRepository(db),
      annotations,
      new FixedClock(NOW),
    );
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')`;
    await owner`
      INSERT INTO projects (id, name, timezone, account_id)
      VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo', ${ACCOUNT_ID})`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('stores the note on a Pro account’s project, with the day in its time zone', async () => {
    await create.execute(SHOP_ID, { day: '2026-11-04', text: 'Released v2.4.0' });

    await expect(
      annotations.listInRange(SHOP_ID, { from: '2026-11-04', to: '2026-11-04' }),
    ).resolves.toMatchObject([{ day: '2026-11-04', text: 'Released v2.4.0', createdAt: NOW }]);
  });

  it('stores nothing for an account on the free plan', async () => {
    await owner`UPDATE accounts SET status = 'free' WHERE id = ${ACCOUNT_ID}`;

    await expect(
      create.execute(SHOP_ID, { day: '2026-11-04', text: 'Released' }),
    ).rejects.toBeInstanceOf(PlanRequiredError);
    expect(await owner`SELECT 1 FROM annotations`).toHaveLength(0);
  });
});
