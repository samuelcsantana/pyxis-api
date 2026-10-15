import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { EXPORT_DISPATCHER, EXPORT_STORAGE } from '../../src/domain/services/export-storage';
import { createDrizzleDatabase } from '../../src/infra/database/postgres-client';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { DrizzleProjectExportRepository } from '../../src/infra/repositories/drizzle-project-export.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import {
  InMemoryExportStorage,
  RecordingExportDispatcher,
} from '../../src/test-utils/in-memory-project-export.repository';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { ProcessProjectExportUseCase } from '../../src/usecases/exports/process-project-export.usecase';
import { createTestApp } from './create-test-app';
import { e2eAppUrl, e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const OWNER_ID = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b01';
const STRANGER_ID = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b02';
const ACCOUNT_ID = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b11';
const SHOP_ID = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b21';
const OWNER_SESSION = 'e2e-exports-owner-session';
const STRANGER_SESSION = 'e2e-exports-stranger-session';

describe('exports of a project', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let appClient: postgres.Sql;
  const storage = new InMemoryExportStorage();
  const dispatcher = new RecordingExportDispatcher();

  const call = (method: 'GET' | 'POST', url: string, session = OWNER_SESSION) =>
    app.inject({
      method,
      url,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}`, origin: E2E_DASHBOARD_ORIGIN },
    });
  const exportsUrl = `/v1/projects/${SHOP_ID}/exports`;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    appClient = postgres(e2eAppUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, 'exports-owner@example.com', 'pt-BR'),
             (${STRANGER_ID}, 'exports-stranger@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'ended')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'Export shop', ${ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os)
      SELECT gen_random_uuid(), ${SHOP_ID}, ${NOW}::timestamptz - (n || ' seconds')::interval,
             ${NOW}, 'page_view', gen_random_uuid(), '/', 'desktop', 'chrome', 'windows'
      FROM generate_series(1, 3) AS n
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(OWNER_SESSION)}, ${NOW}, ${NOW}),
             (${STRANGER_ID}, ${sha256Hex(STRANGER_SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(EXPORT_STORAGE)
        .useValue(storage)
        .overrideProvider(EXPORT_DISPATCHER)
        .useValue(dispatcher),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await appClient.end();
    await owner.end();
  });

  it('exports the events of an ended account for its owner, and gives a short link to the file', async () => {
    const requested = await call('POST', exportsUrl);
    const again = await call('POST', exportsUrl);
    const { export: created } = requested.json<{ export: { id: string } }>();

    expect(requested.statusCode).toBe(202);
    expect(requested.json()).toMatchObject({ requested: true, export: { status: 'pending' } });
    expect(again.json()).toMatchObject({ requested: false, export: { id: created.id } });
    expect(dispatcher.dispatched).toEqual([created.id]);
    expect((await call('GET', `${exportsUrl}/${created.id}`)).json()).toMatchObject({
      status: 'pending',
      download_url: null,
    });

    const repository = new DrizzleProjectExportRepository(createDrizzleDatabase(appClient));
    const mail = new RecordingMailSender();
    const process = new ProcessProjectExportUseCase(
      repository,
      repository,
      storage,
      mail,
      new FixedClock(NOW),
    );
    expect(await process.execute(created.id)).toBe('done');

    const ready = await call('GET', `${exportsUrl}/${created.id}`);
    expect(ready.json()).toMatchObject({
      status: 'done',
      event_count: 3,
      available_until: '2026-11-10T12:00:00.000Z',
      download_url: `https://storage.example.com/exports/${SHOP_ID}/${created.id}.csv.gz?expires=300`,
    });
    const file = storage.files.get(`exports/${SHOP_ID}/${created.id}.csv.gz`);
    expect(file?.content.split('\r\n')).toHaveLength(5);
    expect(mail.exportsReady).toEqual([
      expect.objectContaining({ email: 'exports-owner@example.com', language: 'pt-BR' }),
    ]);
  });

  it('answers not found to anyone but the owner, and needs the dashboard to ask', async () => {
    const stranger = await call('POST', exportsUrl, STRANGER_SESSION);
    const elsewhere = await app.inject({
      method: 'POST',
      url: exportsUrl,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${OWNER_SESSION}`,
        origin: 'https://evil.example.com',
      },
    });
    const missing = await call('GET', `${exportsUrl}/00000000-0000-4000-8000-000000000000`);

    expect(stranger.statusCode).toBe(404);
    expect(elsewhere.statusCode).toBe(403);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'export_not_found' });
  });
});
