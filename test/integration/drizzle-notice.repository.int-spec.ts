import type postgres from 'postgres';
import type { NoticeContent } from '../../src/domain/notices/operator-notice';
import { ENDED_AUDIENCE, NOTICE_AUDIENCE } from '../../src/domain/notices/operator-notice';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleNoticeRepository } from '../../src/infra/repositories/drizzle-notice.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-11-02T12:00:00.000Z');
const LATER = new Date('2026-11-02T13:00:00.000Z');
const ANA = 'e6e7e8e9-0000-4000-8000-000000000001';
const BIA = 'e6e7e8e9-0000-4000-8000-000000000002';
const CARLA = 'e6e7e8e9-0000-4000-8000-000000000003';
const ACTIVE_ID = 'e6e7e8e9-0000-4000-8000-000000000011';
const COMPED_ID = 'e6e7e8e9-0000-4000-8000-000000000012';
const ENDED_ID = 'e6e7e8e9-0000-4000-8000-000000000013';
const CONTENT: NoticeContent = {
  en: { subject: 'Prices change', paragraphs: ['From December.'] },
  'pt-BR': { subject: 'Os preços mudam', paragraphs: ['A partir de dezembro.'] },
  es: { subject: 'Los precios cambian', paragraphs: ['Desde diciembre.'] },
};

describe('operator notices against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let notices: DrizzleNoticeRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    notices = new DrizzleNoticeRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${ANA}, 'ana@example.com', 'pt-BR'), (${BIA}, 'bia@example.com', 'en'),
             (${CARLA}, 'carla@example.com', 'es')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${ACTIVE_ID}, ${ANA}, 'active'), (${COMPED_ID}, ${BIA}, 'comped'),
             (${ENDED_ID}, ${CARLA}, 'ended')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('names the language of each owner the audience reaches, as the application role', async () => {
    expect([...(await notices.audienceLanguages(NOTICE_AUDIENCE))].sort()).toEqual(['en', 'pt-BR']);
    expect(await notices.audienceLanguages(['past_due'])).toEqual([]);
  });

  it('stores a notice with one pending delivery per account, refusing the same campaign twice', async () => {
    const created = await notices.create({
      campaign: 'prices',
      content: CONTENT,
      audience: ENDED_AUDIENCE,
      createdAt: NOW,
    });

    expect(created?.languages).toHaveLength(3);
    expect(
      await notices.create({ campaign: 'prices', content: CONTENT, audience: [], createdAt: NOW }),
    ).toBeNull();
    const pending = await notices.pending(10);
    expect(pending.map((delivery) => delivery.ownerEmail).sort()).toEqual([
      'ana@example.com',
      'bia@example.com',
      'carla@example.com',
    ]);
    expect(pending[0]).toMatchObject({ campaign: 'prices', content: CONTENT });
  });

  it('stores a notice that reaches nobody, and hands out the pending ones up to the limit', async () => {
    expect(
      await notices.create({
        campaign: 'nobody',
        content: CONTENT,
        audience: ['past_due'],
        createdAt: NOW,
      }),
    ).toMatchObject({ languages: [] });
    await notices.create({
      campaign: 'prices',
      content: CONTENT,
      audience: NOTICE_AUDIENCE,
      createdAt: NOW,
    });

    expect(await notices.pending(1)).toHaveLength(1);
  });

  it('marks a delivery sent so it is never handed out again', async () => {
    const created = await notices.create({
      campaign: 'prices',
      content: CONTENT,
      audience: ['active'],
      createdAt: NOW,
    });

    await notices.markSent(created?.noticeId ?? '', ACTIVE_ID, LATER);

    expect(await notices.pending(10)).toEqual([]);
    const [row] = await owner<{ sent_at: Date }[]>`SELECT sent_at FROM notice_deliveries`;
    expect(row?.sent_at).toEqual(LATER);
  });

  it('forgets the deliveries of an account deleted before they went out', async () => {
    await notices.create({
      campaign: 'prices',
      content: CONTENT,
      audience: ['ended'],
      createdAt: NOW,
    });

    await owner`DELETE FROM accounts WHERE id = ${ENDED_ID}`;

    expect(await notices.pending(10)).toEqual([]);
  });
});
