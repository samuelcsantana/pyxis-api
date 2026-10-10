import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { openCliContext } from '../../src/cli/cli-context';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { SESSION_TOKEN_PATTERN } from '../../src/domain/auth/session-policy';
import { MAX_SIGN_IN_CODE_ATTEMPTS } from '../../src/domain/auth/sign-in-code';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { MAX_LANGUAGE_TAG_LENGTH } from '../../src/infra/http/auth/auth.schemas';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { SIGN_IN_REQUESTS_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const PROJECT_ID = 'd6a4f5e7-8e91-4203-b425-d6e7f8091a2b';
const ADMIN_ID = 'e7b5a6f8-9fa2-4314-a536-e7f8091a2b3c';
const ADMIN_EMAIL = 'ana@example.com';
const STRANGER_EMAIL = 'nobody@example.com';
const SESSION_COOKIE_PATTERN = new RegExp(
  `^${SESSION_COOKIE_NAME}=([A-Za-z0-9_-]{43}); HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800$`,
);

let clientCounter = 0;

function nextClientIp(): string {
  clientCounter += 1;
  return `203.0.113.${String(clientCounter)}`;
}

function wrongCodeFor(code: string): string {
  return String((Number(code) + 1) % 1_000_000).padStart(code.length, '0');
}

interface PostOptions {
  readonly origin?: string | null;
  readonly cookie?: string;
  readonly clientIp?: string;
}

describe('dashboard sign-in', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();

  const post = (url: string, payload: Record<string, unknown>, options: PostOptions = {}) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: {
        [E2E_CLIENT_IP_HEADER]: options.clientIp ?? nextClientIp(),
        ...(options.origin === null ? {} : { origin: options.origin ?? E2E_DASHBOARD_ORIGIN }),
        ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      },
    });

  const me = (cookie?: string) =>
    app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        origin: E2E_DASHBOARD_ORIGIN,
        ...(cookie === undefined ? {} : { cookie }),
      },
    });

  const latestCode = (): string => {
    const delivered = mail.sent.at(-1);
    if (delivered === undefined) {
      throw new Error('No sign-in code was mailed.');
    }
    return delivered.code;
  };

  const signIn = async (): Promise<string> => {
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const response = await post('/v1/auth/verify-code', {
      email: ADMIN_EMAIL,
      code: latestCode(),
    });
    if (response.statusCode !== 200) {
      throw new Error(`Unexpected sign-in answer ${String(response.statusCode)}.`);
    }
    const { session_token: token } = response.json<{ session_token: string }>();
    return `${SESSION_COOKIE_NAME}=${token}`;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${PROJECT_ID}, 'Shop', ${['https://shop.example.com']}, 'America/Sao_Paulo',
              'signup_completed')
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, ${ADMIN_EMAIL})`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${ADMIN_ID}, ${PROJECT_ID})
    `;
    app = await createTestApp((builder) => builder.overrideProvider(MAIL_SENDER).useValue(mail));
  });

  beforeEach(async () => {
    mail.sent.length = 0;
    await owner`DELETE FROM otp_codes`;
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('accepts a request for an unknown email the same way, and mails nothing', async () => {
    const response = await post('/v1/auth/request-code', { email: STRANGER_EMAIL });

    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(mail.sent).toEqual([]);
  });

  it('mails a six-digit code to an admin, whatever the case, and stores only its hash', async () => {
    const response = await post('/v1/auth/request-code', { email: 'Ana@Example.COM' });

    expect(response.statusCode).toBe(202);
    expect(mail.sent).toEqual([
      { email: ADMIN_EMAIL, code: expect.stringMatching(/^\d{6}$/) as string, language: 'en' },
    ]);
    const rows = await owner`SELECT email, code_hash FROM otp_codes`;
    expect(rows).toEqual([{ email: ADMIN_EMAIL, code_hash: sha256Hex(latestCode()) }]);
  });

  it('writes the email in the language the dashboard asks for, matched on the language', async () => {
    const brazilian = await post('/v1/auth/request-code', { email: ADMIN_EMAIL, locale: 'pt-BR' });
    const portuguese = await post('/v1/auth/request-code', { email: ADMIN_EMAIL, locale: 'pt-PT' });
    const spanish = await post('/v1/auth/request-code', { email: ADMIN_EMAIL, locale: 'es' });

    expect([brazilian, portuguese, spanish].map((answer) => answer.statusCode)).toEqual([
      202, 202, 202,
    ]);
    expect(mail.sent.map(({ language }) => language)).toEqual(['pt-BR', 'pt-BR', 'en']);
  });

  it('answers 400 to a language that is not a well-formed tag, and mails nothing', async () => {
    const malformed = await post('/v1/auth/request-code', { email: ADMIN_EMAIL, locale: 'pt_BR' });
    const wellFormedButTooLong = ['pt', 'BR', ...Array.from({ length: 4 }, () => 'variants')].join(
      '-',
    );
    const tooLong = await post('/v1/auth/request-code', {
      email: ADMIN_EMAIL,
      locale: wellFormedButTooLong,
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: 'invalid_request' });
    expect(wellFormedButTooLong.length).toBeGreaterThan(MAX_LANGUAGE_TAG_LENGTH);
    expect(tooLong.statusCode).toBe(400);
    expect(mail.sent).toEqual([]);
  });

  it('trades the right code for a session token, answered in the body and in an HttpOnly cookie, stored hashed', async () => {
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });

    const response = await post('/v1/auth/verify-code', {
      email: ADMIN_EMAIL,
      code: latestCode(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ email: string; session_token: string }>();
    expect(body).toEqual({
      email: ADMIN_EMAIL,
      session_token: expect.stringMatching(SESSION_TOKEN_PATTERN) as string,
    });
    expect(response.headers['access-control-allow-origin']).toBe(E2E_DASHBOARD_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    const cookieToken = SESSION_COOKIE_PATTERN.exec(String(response.headers['set-cookie']))?.[1];
    expect(cookieToken).toBe(body.session_token);
    const sessions = await owner`
      SELECT token_hash FROM admin_sessions WHERE token_hash = ${sha256Hex(body.session_token)}
    `;
    expect(sessions).toHaveLength(1);
  });

  it('refuses a code that was already used', async () => {
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const code = latestCode();
    await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code });

    const replay = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code });

    expect(replay.statusCode).toBe(400);
    expect(replay.json()).toMatchObject({ error: 'invalid_code' });
    expect(replay.headers['set-cookie']).toBeUndefined();
  });

  it('burns the code after five concurrent wrong guesses, so the right one fails too', async () => {
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const code = latestCode();

    const guesses = await Promise.all(
      Array.from({ length: MAX_SIGN_IN_CODE_ATTEMPTS }, () =>
        post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: wrongCodeFor(code) }),
      ),
    );
    const right = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code });

    expect(guesses.map((guess) => guess.statusCode)).toEqual(
      Array.from({ length: MAX_SIGN_IN_CODE_ATTEMPTS }, () => 400),
    );
    expect(right.statusCode).toBe(400);
    expect(right.json()).toMatchObject({ error: 'invalid_code' });
  });

  it('answers 400 with a generic message to a body that breaks the contract', async () => {
    const response = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: '12345a' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      status_code: 400,
      error: 'invalid_request',
      message: 'The request body does not match the contract.',
    });
  });

  it('refuses sign-in calls from another origin, and from no origin at all', async () => {
    const foreign = await post(
      '/v1/auth/request-code',
      { email: ADMIN_EMAIL },
      { origin: 'https://evil.example.com' },
    );
    const bare = await post('/v1/auth/request-code', { email: ADMIN_EMAIL }, { origin: null });

    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toMatchObject({ error: 'origin_not_allowed' });
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    expect(bare.statusCode).toBe(403);
    expect(mail.sent).toEqual([]);
  });

  it('answers the dashboard preflight and grants it credentials', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/verify-code',
      headers: {
        origin: E2E_DASHBOARD_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers).toMatchObject({
      'access-control-allow-origin': E2E_DASHBOARD_ORIGIN,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    });
  });

  it('describes the signed-in admin and their projects, and nobody else', async () => {
    const anonymous = await me();
    const forged = await me(`${SESSION_COOKIE_NAME}=${'A'.repeat(43)}`);
    const signedIn = await me(await signIn());

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({ error: 'unauthenticated' });
    expect(forged.statusCode).toBe(401);
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json()).toEqual({
      email: ADMIN_EMAIL,
      projects: [
        {
          id: PROJECT_ID,
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          conversion_event: 'signup_completed',
          first_event_at: null,
          last_event_at: null,
        },
      ],
    });
  });

  it('signs out: the session stops working and the cookie is cleared', async () => {
    const cookie = await signIn();

    const response = await post('/v1/auth/logout', {}, { cookie });
    const after = await me(cookie);

    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toBe(
      `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    );
    expect(after.statusCode).toBe(401);
  });

  it('lets an admin granted by the admin:grant script sign in and see the project', async () => {
    const scripts = openCliContext({ MIGRATION_DATABASE_URL: e2eOwnerUrl() });
    try {
      await scripts.grantAdminAccess.execute({ email: 'bia@example.com', projectId: PROJECT_ID });
    } finally {
      await scripts.close();
    }
    await post('/v1/auth/request-code', { email: 'bia@example.com' });
    const verified = await post('/v1/auth/verify-code', {
      email: 'bia@example.com',
      code: latestCode(),
    });
    const token = SESSION_COOKIE_PATTERN.exec(String(verified.headers['set-cookie']))?.[1];

    const described = await me(`${SESSION_COOKIE_NAME}=${String(token)}`);

    expect(verified.statusCode).toBe(200);
    expect(described.json()).toMatchObject({
      email: 'bia@example.com',
      projects: [{ id: PROJECT_ID }],
    });
  });

  it('limits each address to five code requests every fifteen minutes', async () => {
    const clientIp = nextClientIp();

    const answers = [];
    for (let attempt = 0; attempt <= SIGN_IN_REQUESTS_PER_WINDOW; attempt += 1) {
      answers.push(await post('/v1/auth/request-code', { email: STRANGER_EMAIL }, { clientIp }));
    }
    const blocked = answers.at(-1);

    expect(answers.slice(0, -1).map((answer) => answer.statusCode)).toEqual(
      Array.from({ length: SIGN_IN_REQUESTS_PER_WINDOW }, () => 202),
    );
    expect(blocked?.statusCode).toBe(429);
    expect(Number(blocked?.headers['retry-after'])).toBeGreaterThan(0);
  });
});
