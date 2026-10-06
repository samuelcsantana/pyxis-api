import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { openCliContext } from '../../src/cli/cli-context';
import type { CliContext } from '../../src/cli/cli-command';
import { SUBJECT_REQUESTS_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

describe('subject erasure and export', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let scripts: CliContext;
  let projectId: string;
  let secretKey: string;
  let otherSecretKey: string;

  const call = (method: 'GET' | 'DELETE', url: string, key: string | null = secretKey) =>
    app.inject({
      method,
      url,
      headers: key === null ? {} : { authorization: `Bearer ${key}` },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    scripts = openCliContext({ MIGRATION_DATABASE_URL: e2eOwnerUrl() });
    const project = await scripts.createProject.execute({
      name: 'Subjects Shop',
      allowedOrigins: ['https://subjects.example.com'],
    });
    projectId = project.projectId;
    secretKey = (await scripts.createProjectKey.execute({ projectId, kind: 'secret' })).key;
    const other = await scripts.createProject.execute({
      name: 'Throttled Shop',
      allowedOrigins: ['https://throttled.example.com'],
    });
    otherSecretKey = (
      await scripts.createProjectKey.execute({ projectId: other.projectId, kind: 'secret' })
    ).key;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, user_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${projectId}, '2026-10-04T12:00:00Z', now(), 'page_view',
         'f0000000-0000-4000-8000-000000000001', NULL, '/calculator', 'mobile', 'safari', 'ios', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-10-04T12:05:00Z', now(), 'identify',
         'f0000000-0000-4000-8000-000000000001', 'ana', '/', 'mobile', 'safari', 'ios', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-10-05T09:00:00Z', now(), 'page_view',
         'f0000000-0000-4000-8000-000000000002', 'bruno', '/', 'mobile', 'safari', 'ios', '{}')
    `;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await scripts.close();
    await owner.end();
  });

  it('exports every event about the person, the anonymous visit included', async () => {
    const response = await call('GET', '/v1/subjects/ana/events');

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(
      response.json<{ events: { name: string; path: string }[]; next_after: string | null }>(),
    ).toMatchObject({
      events: [
        { name: 'page_view', path: '/calculator' },
        { name: 'identify', path: '/' },
      ],
      next_after: null,
    });
  });

  it('refuses a cursor that names no event', async () => {
    const response = await call(
      'GET',
      '/v1/subjects/ana/events?after=00000000-0000-4000-8000-000000000000',
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_cursor' });
  });

  it('erases the person once, then answers zero', async () => {
    const first = await call('DELETE', '/v1/subjects/ana');
    const again = await call('DELETE', '/v1/subjects/ana');
    const left = await owner<{ user_id: string | null }[]>`
      SELECT user_id FROM events WHERE project_id = ${projectId}
    `;

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ deleted_events: 2 });
    expect(again.json()).toEqual({ deleted_events: 0 });
    expect(left).toEqual([{ user_id: 'bruno' }]);
  });

  it.each([
    ['no key', null],
    ['a public key', `pyxis_pk_${'P'.repeat(32)}`],
    ['an unknown secret key', `pyxis_sk_${'U'.repeat(32)}`],
  ])('answers 401 to %s', async (_case, key) => {
    const response = await call('DELETE', '/v1/subjects/ana', key);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unknown_key' });
  });

  it('answers 400 to a user id the site could never have sent', async () => {
    const response = await call('DELETE', `/v1/subjects/${'a'.repeat(65)}`);

    expect(response.statusCode).toBe(400);
  });

  it('limits each key to sixty calls a minute', async () => {
    const answers = [];
    for (let attempt = 0; attempt <= SUBJECT_REQUESTS_PER_WINDOW; attempt += 1) {
      answers.push(await call('DELETE', '/v1/subjects/nobody', otherSecretKey));
    }

    expect(answers.at(-2)?.statusCode).toBe(200);
    expect(answers.at(-1)?.statusCode).toBe(429);
    expect(Number(answers.at(-1)?.headers['retry-after'])).toBeGreaterThan(0);
  });
});
