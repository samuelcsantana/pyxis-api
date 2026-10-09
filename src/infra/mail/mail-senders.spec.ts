import { Logger } from '@nestjs/common';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import { createMailSender } from './create-mail-sender';
import { LoggingMailSender } from './logging-mail-sender';
import { RESEND_EMAILS_URL, ResendMailSender } from './resend-mail-sender';
import { buildSignInCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

const FROM = 'Pyxis <noreply@pyxis-analytics.dev>';
const API_KEY = 'test-api-key';
const DIGEST: WeeklyDigest = {
  projectId: 'd2e07854-0000-4000-8000-000000000001',
  projectName: 'Acme Store',
  timeZone: 'UTC',
  week: { from: '2026-10-05', to: '2026-10-11' },
  visits: { current: 12, previous: 10 },
  identifiedUsers: { current: 2, previous: 2 },
  convertingVisits: null,
  failedWrites: { current: { failed: 0, total: 4 }, previous: { failed: 1, total: 3 } },
  days: [{ date: '2026-10-05', visits: 12 }],
  topPages: [],
  topEvents: [],
  failingRoutes: [],
  lastEventAt: null,
};

describe('ResendMailSender', () => {
  it("posts the email to Resend's API with the key as a bearer token", async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-1"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, send).sendSignInCode(
      'ana@example.com',
      '123456',
      'pt-BR',
    );

    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'ana@example.com',
      ...buildSignInCodeEmail('123456', 'pt-BR'),
    });
  });

  it('posts the weekly digest the same way, written in the language asked for', async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-2"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, send).sendWeeklyDigest(
      'ana@example.com',
      DIGEST,
      'pt-BR',
    );

    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'ana@example.com',
      ...buildWeeklyDigestEmail(DIGEST, 'pt-BR'),
    });
  });

  it('fails with the status only, so the recipient never reaches a log', async () => {
    const send = () =>
      Promise.resolve(new Response('{"message":"ana@example.com is invalid"}', { status: 422 }));

    await expect(
      new ResendMailSender(API_KEY, FROM, send).sendSignInCode('ana@example.com', '123456', 'en'),
    ).rejects.toThrow(/^Resend answered 422$/);
  });

  it('uses the global fetch by default', () => {
    expect(new ResendMailSender(API_KEY, FROM)).toBeInstanceOf(ResendMailSender);
  });
});

describe('LoggingMailSender', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs the code and its language for local development, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendSignInCode('ana@example.com', '123456', 'pt-BR');

    expect(logs).toEqual([{ message: 'mail.sign_in_code', code: '123456', language: 'pt-BR' }]);
  });

  it('logs the project, week and subject of a weekly digest, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendWeeklyDigest('ana@example.com', DIGEST, 'en');

    expect(logs).toEqual([
      {
        message: 'mail.weekly_digest',
        projectId: DIGEST.projectId,
        week: DIGEST.week,
        language: 'en',
        subject: buildWeeklyDigestEmail(DIGEST, 'en').subject,
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('ana@example.com');
  });
});

describe('createMailSender', () => {
  it('sends through Resend whenever a key is configured', () => {
    expect(
      createMailSender({ NODE_ENV: 'production', RESEND_API_KEY: API_KEY, MAIL_FROM: FROM }),
    ).toBeInstanceOf(ResendMailSender);
  });

  it('logs codes only outside production', () => {
    expect(
      createMailSender({ NODE_ENV: 'development', RESEND_API_KEY: undefined, MAIL_FROM: FROM }),
    ).toBeInstanceOf(LoggingMailSender);
  });

  it('refuses to start in production without a key', () => {
    expect(() =>
      createMailSender({ NODE_ENV: 'production', RESEND_API_KEY: undefined, MAIL_FROM: FROM }),
    ).toThrow('RESEND_API_KEY is required in production');
  });
});
