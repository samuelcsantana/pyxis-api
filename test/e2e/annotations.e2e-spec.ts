import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-05T02:00:00.000Z');
const OWNER_ID = 'e9a00000-0000-4000-8000-000000000001';
const MEMBER_ID = 'e9a00000-0000-4000-8000-000000000002';
const ACCOUNT_ID = 'e9a00000-0000-4000-8000-000000000011';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-annotations-owner-session`;
const MEMBER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-annotations-member-session`;
const ACCESS_TOKEN = `pyxis_at_${'N'.repeat(32)}`;
const RANGE = 'from=2026-11-01&to=2026-11-04';

interface AnnotationBody {
  readonly id: string;
  readonly day: string;
  readonly text: string;
}

interface Call {
  readonly cookie?: string | null;
  readonly origin?: string | null;
  readonly authorization?: string;
  readonly payload?: object;
}

describe('annotations, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, options: Call = {}) => {
    const cookie = options.cookie === undefined ? OWNER_COOKIE : options.cookie;
    const origin = options.origin === undefined ? E2E_DASHBOARD_ORIGIN : options.origin;
    return app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: {
        [E2E_CLIENT_IP_HEADER]: '198.51.100.91',
        ...(cookie === null ? {} : { cookie }),
        ...(origin === null ? {} : { origin }),
        ...(options.authorization === undefined ? {} : { authorization: options.authorization }),
      },
    });
  };
  const annotationsUrl = () => `/v1/projects/${projectId}/annotations`;
  const write = async (day: string, text: string) => {
    const response = await call('POST', annotationsUrl(), { payload: { day, text } });
    expect(response.statusCode).toBe(201);
    return response.json<AnnotationBody>();
  };
  const listed = async (options: Call = {}) =>
    (await call('GET', `${annotationsUrl()}?${RANGE}`, options)).json<{
      annotations: AnnotationBody[];
    }>().annotations;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${OWNER_ID}, 'annotations-owner@example.com'),
             (${MEMBER_ID}, 'annotations-member@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'free')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-annotations-owner-session')}, ${NOW}, ${NOW}),
             (${MEMBER_ID}, ${sha256Hex('e2e-annotations-member-session')}, ${NOW}, ${NOW})`;
    await owner`
      INSERT INTO admin_access_tokens (admin_user_id, name, token_hash, created_at, expires_at)
      VALUES (${MEMBER_ID}, 'Agent', ${sha256Hex(ACCESS_TOKEN)}, ${NOW},
              ${new Date('2027-01-01T00:00:00.000Z')})`;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      payload: {
        name: 'Annotated shop',
        allowed_origins: ['https://annotated-shop.example.com'],
        timezone: 'America/Sao_Paulo',
      },
    });
    projectId = created.json<{ project_id: string }>().project_id;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${MEMBER_ID}, ${projectId})`;
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_access_tokens WHERE admin_user_id = ${MEMBER_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner.end();
  });

  afterEach(async () => {
    await owner`DELETE FROM annotations WHERE project_id = ${projectId}`;
  });

  it('lets the owner write notes on the free plan, listed by day for anyone who reads', async () => {
    const launch = await write('2026-11-04', '  Launched   the new pricing ');
    await write('2026-11-02', 'Newsletter sent');

    expect(launch).toMatchObject({ day: '2026-11-04', text: 'Launched the new pricing' });
    expect((await listed()).map(({ text }) => text)).toEqual([
      'Newsletter sent',
      'Launched the new pricing',
    ]);
    expect(await listed({ cookie: MEMBER_COOKIE })).toHaveLength(2);
    expect(
      await listed({ cookie: null, origin: null, authorization: `Bearer ${ACCESS_TOKEN}` }),
    ).toHaveLength(2);
  });

  it('moves and rewrites a note, then deletes it', async () => {
    const { id } = await write('2026-11-03', 'Launch');

    const moved = await call('PATCH', `${annotationsUrl()}/${id}`, {
      payload: { day: '2026-11-04', text: 'Launch day' },
    });
    const deleted = await call('DELETE', `${annotationsUrl()}/${id}`);

    expect(moved.json()).toMatchObject({ id, day: '2026-11-04', text: 'Launch day' });
    expect(deleted.statusCode).toBe(204);
    expect(await listed()).toEqual([]);
  });

  it('answers 404 to a person of the project who does not own the account, for every write', async () => {
    const { id } = await write('2026-11-03', 'Launch');

    const answers = await Promise.all([
      call('POST', annotationsUrl(), {
        cookie: MEMBER_COOKIE,
        payload: { day: '2026-11-03', text: 'X' },
      }),
      call('PATCH', `${annotationsUrl()}/${id}`, { cookie: MEMBER_COOKIE, payload: { text: 'X' } }),
      call('DELETE', `${annotationsUrl()}/${id}`, { cookie: MEMBER_COOKIE }),
    ]);

    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404]);
    expect(answers[0].json()).toMatchObject({ error: 'project_not_found' });
  });

  it('never writes with an access token, which stays read-only', async () => {
    const response = await call('POST', annotationsUrl(), {
      cookie: null,
      authorization: `Bearer ${ACCESS_TOKEN}`,
      payload: { day: '2026-11-03', text: 'From an agent' },
    });

    expect(response.statusCode).toBe(401);
    expect(await listed()).toEqual([]);
  });

  it.each([
    [
      'a day not yet started in the project time zone',
      { day: '2026-11-05', text: 'Soon' },
      'invalid_annotation',
    ],
    ['a note too long', { day: '2026-11-04', text: 'x'.repeat(141) }, 'invalid_annotation'],
    ['a note of spaces only', { day: '2026-11-04', text: '   ' }, 'invalid_annotation'],
    ['a day that is not a date', { day: '2026-02-30', text: 'X' }, 'invalid_request'],
  ])('refuses %s with 400', async (_case, payload, error) => {
    const response = await call('POST', annotationsUrl(), { payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
  });

  it('answers annotation_not_found for a note of no such id', async () => {
    const response = await call('PATCH', `${annotationsUrl()}/${MISSING_ID}`, {
      payload: { text: 'X' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'annotation_not_found' });
  });

  it('refuses to write from outside the dashboard', async () => {
    const response = await call('POST', annotationsUrl(), {
      origin: null,
      payload: { day: '2026-11-04', text: 'X' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a list range that ends after today in the project time zone', async () => {
    const response = await call('GET', `${annotationsUrl()}?from=2026-11-01&to=2026-11-05`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_range' });
  });

  it('shows the notes on a public share link of a Pro account', async () => {
    await owner`UPDATE accounts SET status = 'active' WHERE id = ${ACCOUNT_ID}`;
    await write('2026-11-04', 'Launched the new pricing');
    const link = await call('POST', `/v1/projects/${projectId}/share-links`, {
      payload: { name: 'Board' },
    });
    const { token } = link.json<{ token: string }>();

    const shared = await call('GET', `/v1/shared/${token}/annotations?${RANGE}`, {
      cookie: null,
      origin: null,
    });
    const filtered = await call('GET', `/v1/shared/${token}/annotations?${RANGE}&path=/`, {
      cookie: null,
      origin: null,
    });

    expect(shared.statusCode).toBe(200);
    expect(shared.json()).toEqual((await call('GET', `${annotationsUrl()}?${RANGE}`)).json());
    expect(filtered.statusCode).toBe(400);
    await owner`DELETE FROM share_links WHERE project_id = ${projectId}`;
    await owner`UPDATE accounts SET status = 'free' WHERE id = ${ACCOUNT_ID}`;
  });

  describe('written with the project secret key, from a deploy', () => {
    let blogId = '';
    let shopKey = '';
    let blogKey = '';

    const byKey = (key: string, payload: object) =>
      app.inject({
        method: 'POST',
        url: '/v1/annotations',
        payload,
        headers: { authorization: `Bearer ${key}`, [E2E_CLIENT_IP_HEADER]: '198.51.100.92' },
      });
    const secretKeyOf = async (id: string) =>
      (await call('POST', `/v1/projects/${id}/keys`, { payload: { kind: 'secret' } })).json<{
        key: string;
      }>().key;
    const notesOf = async (id: string) =>
      (await call('GET', `/v1/projects/${id}/annotations?${RANGE}`)).json<{
        annotations: AnnotationBody[];
      }>().annotations;

    beforeAll(async () => {
      await owner`UPDATE accounts SET status = 'active' WHERE id = ${ACCOUNT_ID}`;
      const blog = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
        payload: {
          name: 'Annotated blog',
          allowed_origins: ['https://annotated-blog.example.com'],
          timezone: 'UTC',
        },
      });
      blogId = blog.json<{ project_id: string }>().project_id;
      shopKey = await secretKeyOf(projectId);
      blogKey = await secretKeyOf(blogId);
    });

    afterEach(async () => {
      await owner`UPDATE accounts SET status = 'active' WHERE id = ${ACCOUNT_ID}`;
      await owner`DELETE FROM annotations WHERE project_id = ${blogId}`;
    });

    afterAll(async () => {
      await owner`UPDATE accounts SET status = 'free' WHERE id = ${ACCOUNT_ID}`;
    });

    it('writes the note on the key’s project on Pro, listed like any other', async () => {
      const response = await byKey(shopKey, { day: '2026-11-04', text: 'Released v2.4.0' });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ day: '2026-11-04', text: 'Released v2.4.0' });
      expect((await notesOf(projectId)).map(({ text }) => text)).toEqual(['Released v2.4.0']);
      expect(await notesOf(blogId)).toEqual([]);
    });

    it('writes with another project’s key only on that project, never this one', async () => {
      const own = await byKey(blogKey, { day: '2026-11-04', text: 'Blog release' });
      const aimed = await byKey(blogKey, {
        day: '2026-11-04',
        text: 'Shop release',
        project_id: projectId,
      });

      expect(own.statusCode).toBe(201);
      expect(aimed.statusCode).toBe(400);
      expect(await notesOf(projectId)).toEqual([]);
      expect((await notesOf(blogId)).map(({ text }) => text)).toEqual(['Blog release']);
    });

    it('refuses the free plan with plan_required', async () => {
      await owner`UPDATE accounts SET status = 'free' WHERE id = ${ACCOUNT_ID}`;

      const response = await byKey(shopKey, { day: '2026-11-04', text: 'Released' });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: 'plan_required',
        message: expect.stringContaining('annotations_by_token') as string,
      });
      expect(await notesOf(projectId)).toEqual([]);
    });

    it.each([
      ['a key that does not exist', `pyxis_sk_${'Z'.repeat(32)}`],
      ['a public key', `pyxis_pk_${'Z'.repeat(32)}`],
      ['an access token', ACCESS_TOKEN],
    ])('answers 401 to %s', async (_case, key) => {
      const response = await byKey(key, { day: '2026-11-04', text: 'Released' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: 'unknown_key' });
    });

    it('applies the dashboard’s rules to the day and the text', async () => {
      const tomorrow = await byKey(shopKey, { day: '2026-11-05', text: 'Soon' });
      const tooLong = await byKey(shopKey, { day: '2026-11-04', text: 'x'.repeat(141) });

      expect([tomorrow.statusCode, tooLong.statusCode]).toEqual([400, 400]);
      expect(tomorrow.json()).toMatchObject({ error: 'invalid_annotation' });
    });
  });
});
