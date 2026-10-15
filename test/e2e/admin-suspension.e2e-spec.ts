import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const PROJECT_ID = '9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f21';
const ADMIN_ID = '9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f01';
const ADMIN_EMAIL = 'suspended-person@example.com';
const RANGE = 'from=2026-10-13&to=2026-10-14';

let addressCounter = 0;

function nextAddress(): string {
  addressCounter += 1;
  return `203.0.113.${String(150 + addressCounter)}`;
}

describe('a person suspended by the operator', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();

  const post = (url: string, payload: Record<string, unknown>, cookie?: string) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: {
        [E2E_CLIENT_IP_HEADER]: nextAddress(),
        origin: E2E_DASHBOARD_ORIGIN,
        ...(cookie === undefined ? {} : { cookie }),
      },
    });

  const get = (url: string, headers: Record<string, string>) =>
    app.inject({ method: 'GET', url, headers: { origin: E2E_DASHBOARD_ORIGIN, ...headers } });

  const latestCode = (): string => {
    const delivered = mail.sent.at(-1);
    if (delivered === undefined) {
      throw new Error('No sign-in code was mailed.');
    }
    return delivered.code;
  };

  const suspend = (suspended: boolean) =>
    owner`UPDATE admin_users SET suspended_at = ${suspended ? new Date() : null} WHERE id = ${ADMIN_ID}`;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`DELETE FROM otp_codes WHERE email = ${ADMIN_EMAIL}`;
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone)
      VALUES (${PROJECT_ID}, 'Person shop', ${['https://person.example.com']}, 'UTC')
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, ${ADMIN_EMAIL})`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${ADMIN_ID}, ${PROJECT_ID})
    `;
    app = await createTestApp((builder) => builder.overrideProvider(MAIL_SENDER).useValue(mail));
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE id = ${PROJECT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${ADMIN_ID}`;
    await owner`DELETE FROM otp_codes WHERE email = ${ADMIN_EMAIL}`;
    await owner.end();
  });

  it('can no longer use a session or a token it already had, nor sign in with a code sent before', async () => {
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const signedIn = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: latestCode() });
    const cookie = `${SESSION_COOKIE_NAME}=${signedIn.json<{ session_token: string }>().session_token}`;
    const created = await post('/v1/me/tokens', { name: 'Agent' }, cookie);
    const { token } = created.json<{ token: string }>();
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const pendingCode = latestCode();

    await suspend(true);
    const answers = [
      await get('/v1/me', { cookie }),
      await get(`/v1/projects/${PROJECT_ID}/overview?${RANGE}`, {
        authorization: `Bearer ${token}`,
      }),
      await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: pendingCode }),
    ];

    expect(answers.map((answer) => answer.statusCode)).toEqual([401, 401, 400]);
  });

  it('is sent no code, the answer being the same as for anyone', async () => {
    mail.sent.length = 0;

    const response = await post('/v1/auth/request-code', { email: ADMIN_EMAIL });

    expect(response.statusCode).toBe(202);
    expect(mail.sent).toEqual([]);
  });

  it('signs in again once the suspension is lifted', async () => {
    await suspend(false);

    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });
    const signedIn = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: latestCode() });

    expect(signedIn.statusCode).toBe(200);
  });
});
