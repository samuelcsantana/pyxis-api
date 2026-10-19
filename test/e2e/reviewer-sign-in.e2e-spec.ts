import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { MAX_REVIEWER_CODE_FAILURES } from '../../src/domain/auth/reviewer-code';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const PROJECT_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41';
const ADMIN_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e01';
const ADMIN_EMAIL = 'directory-reviewer@example.com';
const REVIEWER_CODE = '424242';
const WRONG_CODE = '000000';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

let addressCounter = 0;

function nextAddress(): string {
  addressCounter += 1;
  return `198.51.100.${String(20 + (addressCounter % 200))}`;
}

describe('a reviewer who signs in with a code the operator opened', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();

  const post = (url: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: { [E2E_CLIENT_IP_HEADER]: nextAddress(), origin: E2E_DASHBOARD_ORIGIN },
    });

  const openReviewerCode = () =>
    owner`
      INSERT INTO reviewer_codes (admin_user_id, code_hash, created_at, expires_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(REVIEWER_CODE)}, now(), ${new Date(Date.now() + YEAR_MS)})
      ON CONFLICT (admin_user_id) DO UPDATE SET failed_attempts = 0
    `;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`DELETE FROM otp_codes WHERE email = ${ADMIN_EMAIL}`;
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone)
      VALUES (${PROJECT_ID}, 'Demo store', ${['https://store.example.com']}, 'UTC')
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, ${ADMIN_EMAIL})`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${ADMIN_ID}, ${PROJECT_ID})
    `;
    await openReviewerCode();
    app = await createTestApp((builder) => builder.overrideProvider(MAIL_SENDER).useValue(mail));
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE id = ${PROJECT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${ADMIN_ID}`;
    await owner`DELETE FROM otp_codes WHERE email = ${ADMIN_EMAIL}`;
    await owner.end();
  });

  it('is e-mailed no code, the answer being the same as for anyone', async () => {
    mail.sent.length = 0;

    const response = await post('/v1/auth/request-code', { email: ADMIN_EMAIL });

    expect(response.statusCode).toBe(202);
    expect(mail.sent).toEqual([]);
  });

  it('signs in with the same code twice and reads the project it was granted', async () => {
    const first = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: REVIEWER_CODE });
    const second = await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: REVIEWER_CODE });
    const cookie = `${SESSION_COOKIE_NAME}=${second.json<{ session_token: string }>().session_token}`;

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin: E2E_DASHBOARD_ORIGIN, cookie },
    });

    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(me.statusCode).toBe(200);
    expect(JSON.stringify(me.json())).toContain(PROJECT_ID);
  });

  it(`closes the code after ${String(MAX_REVIEWER_CODE_FAILURES)} wrong codes, then e-mails codes again`, async () => {
    const statuses: number[] = [];
    for (let guess = 0; guess < MAX_REVIEWER_CODE_FAILURES; guess += 1) {
      statuses.push(
        (await post('/v1/auth/verify-code', { email: ADMIN_EMAIL, code: WRONG_CODE })).statusCode,
      );
    }
    const rightButClosed = await post('/v1/auth/verify-code', {
      email: ADMIN_EMAIL,
      code: REVIEWER_CODE,
    });
    mail.sent.length = 0;
    await post('/v1/auth/request-code', { email: ADMIN_EMAIL });

    expect(new Set(statuses)).toEqual(new Set([400]));
    expect(rightButClosed.statusCode).toBe(400);
    expect(
      await owner`SELECT 1 FROM reviewer_codes WHERE admin_user_id = ${ADMIN_ID}`,
    ).toHaveLength(0);
    expect(mail.sent.map((sent) => sent.email)).toEqual([ADMIN_EMAIL]);
  });
});
