import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFreeSiteSharingRepository } from '../../src/infra/repositories/drizzle-free-site-sharing.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const ANA = 'd1d2d3d4-0000-4000-8000-000000000001';
const BIA = 'd1d2d3d4-0000-4000-8000-000000000002';
const CAIO = 'd1d2d3d4-0000-4000-8000-000000000003';
const DORA = 'd1d2d3d4-0000-4000-8000-000000000004';
const ANAS_FREE = 'd1d2d3d4-0000-4000-8000-000000000011';
const BIAS_PAID = 'd1d2d3d4-0000-4000-8000-000000000012';
const CAIOS_ENDED = 'd1d2d3d4-0000-4000-8000-000000000013';
const DORAS_FREE = 'd1d2d3d4-0000-4000-8000-000000000014';
const ANAS_SHOP = 'd1d2d3d4-0000-4000-8000-000000000021';
const ANAS_SHOP_COPY = 'd1d2d3d4-0000-4000-8000-000000000022';
const BIAS_SHOP = 'd1d2d3d4-0000-4000-8000-000000000023';
const CAIOS_SHOP = 'd1d2d3d4-0000-4000-8000-000000000024';
const DORAS_BLOG = 'd1d2d3d4-0000-4000-8000-000000000025';
const OPERATORS_SHOP = 'd1d2d3d4-0000-4000-8000-000000000026';
const SHOP = 'https://shop.example.com';
const DEVELOPER_MACHINE = 'http://localhost:3000';

describe('free accounts that share a site, against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let sharing: DrizzleFreeSiteSharingRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    sharing = new DrizzleFreeSiteSharingRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ANA}, 'ana@example.com'), (${BIA}, 'bia@example.com'),
             (${CAIO}, 'caio@example.com'), (${DORA}, 'dora@example.com')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${ANAS_FREE}, ${ANA}, 'free'), (${BIAS_PAID}, ${BIA}, 'active'),
             (${CAIOS_ENDED}, ${CAIO}, 'ended'), (${DORAS_FREE}, ${DORA}, 'free')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id, allowed_origins)
      VALUES (${ANAS_SHOP}, 'Shop', ${ANAS_FREE}, ${[SHOP, DEVELOPER_MACHINE]}),
             (${ANAS_SHOP_COPY}, 'Shop copy', ${ANAS_FREE}, ${[SHOP]}),
             (${BIAS_SHOP}, 'Shop', ${BIAS_PAID}, ${[DEVELOPER_MACHINE, SHOP]}),
             (${CAIOS_SHOP}, 'Shop', ${CAIOS_ENDED}, ${[SHOP]}),
             (${DORAS_BLOG}, 'Blog', ${DORAS_FREE}, ${['https://blog.example.com']}),
             (${OPERATORS_SHOP}, 'Shop', NULL, ${[SHOP]})
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists each origin of a free account allowed by a project of another live account or of none', async () => {
    expect(await sharing.siteOverlapsOfFreeAccounts()).toEqual([
      {
        accountId: ANAS_FREE,
        projectId: ANAS_SHOP,
        origin: DEVELOPER_MACHINE,
        otherProjectId: BIAS_SHOP,
      },
      { accountId: ANAS_FREE, projectId: ANAS_SHOP, origin: SHOP, otherProjectId: BIAS_SHOP },
      { accountId: ANAS_FREE, projectId: ANAS_SHOP, origin: SHOP, otherProjectId: OPERATORS_SHOP },
      { accountId: ANAS_FREE, projectId: ANAS_SHOP_COPY, origin: SHOP, otherProjectId: BIAS_SHOP },
      {
        accountId: ANAS_FREE,
        projectId: ANAS_SHOP_COPY,
        origin: SHOP,
        otherProjectId: OPERATORS_SHOP,
      },
    ]);
  });

  it('lists nothing once no other account allows the same origin', async () => {
    await owner`
      UPDATE projects SET allowed_origins = ARRAY['https://' || id || '.example.com']
      WHERE account_id IS DISTINCT FROM ${ANAS_FREE}
    `;

    expect(await sharing.siteOverlapsOfFreeAccounts()).toEqual([]);
  });
});
