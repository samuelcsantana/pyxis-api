import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { openCliContext } from '../../src/cli/cli-context';
import type { CliContext } from '../../src/cli/cli-command';
import { CLOCK } from '../../src/domain/services/clock';
import { PROJECT_KEY_CACHE_TTL_MS } from '../../src/infra/repositories/caching-project.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER } from './env-setup';

const ORIGIN = 'https://scripts.example.com';

describe('project scripts and ingestion', () => {
  let app: NestFastifyApplication;
  let scripts: CliContext;
  const clock = new FixedClock(new Date('2026-10-06T14:00:00.000Z'));

  beforeAll(async () => {
    scripts = openCliContext({ MIGRATION_DATABASE_URL: e2eOwnerUrl() });
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
  });

  afterAll(async () => {
    await app.close();
    await scripts.close();
  });

  const send = (key: string, index: number) =>
    app.inject({
      method: 'POST',
      url: '/v1/batch',
      headers: {
        'content-type': 'text/plain',
        origin: ORIGIN,
        [E2E_CLIENT_IP_HEADER]: '192.0.2.77',
      },
      payload: JSON.stringify({
        key,
        sent_at: '2026-10-06T14:00:00.000Z',
        events: [
          {
            id: `3c1d2e4f-5a6b-4c7d-8e9f-${String(index).padStart(12, '0')}`,
            name: 'page_view',
            occurred_at: '2026-10-06T13:59:59.000Z',
            session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
            path: '/',
          },
        ],
      }),
    });

  it('accepts a new project key at once and refuses it once revoked and out of the cache', async () => {
    const project = await scripts.createProject.execute({
      name: 'Scripts',
      allowedOrigins: [ORIGIN],
    });

    expect((await send(project.publicKey, 1)).statusCode).toBe(202);

    await scripts.revokeProjectKey.execute(project.publicKeyId);
    expect((await send(project.publicKey, 2)).statusCode).toBe(202);

    clock.advanceBy(PROJECT_KEY_CACHE_TTL_MS);
    const refused = await send(project.publicKey, 3);

    expect(refused.statusCode).toBe(401);
    expect(refused.json()).toMatchObject({ error: 'unknown_key' });
  });

  it('starts accepting a rotated public key while the old one still works', async () => {
    const project = await scripts.createProject.execute({
      name: 'Rotation',
      allowedOrigins: [ORIGIN],
    });

    const rotated = await scripts.createProjectKey.execute({
      projectId: project.projectId,
      kind: 'public',
    });

    expect((await send(rotated.key, 11)).statusCode).toBe(202);
    expect((await send(project.publicKey, 12)).statusCode).toBe(202);
  });
});
