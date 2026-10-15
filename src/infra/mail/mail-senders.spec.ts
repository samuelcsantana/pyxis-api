import { Logger } from '@nestjs/common';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import { createMailSender } from './create-mail-sender';
import { emailLinksFor } from './email-layout';
import { LoggingMailSender } from './logging-mail-sender';
import { SendEmailCommand, type SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import { RESEND_EMAILS_URL, ResendMailSender } from './resend-mail-sender';
import { SesMailSender, sesSend } from './ses-mail-sender';
import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import { buildQuotaNoticeEmail } from './quota-notice-email';
import { buildAccountNoticeEmail } from './account-notice-email';
import { buildInvitationEmail } from './invitation-email';
import { buildWelcomeEmail } from './welcome-email';
import { buildSignInCodeEmail, buildSignUpCodeEmail } from './sign-in-code-email';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

const FROM = 'Pyxis <noreply@pyxis-analytics.dev>';
const API_KEY = 'test-api-key';
const DASHBOARD_ORIGIN = 'https://dashboard.example.com';
const LINKS = emailLinksFor(DASHBOARD_ORIGIN);
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

const SUPPORT = 'hello@example.com';
const PAUSED: QuotaNotice = {
  kind: 'quota_paused',
  events: 150_412,
  limit: 100_000,
  month: '2026-10',
  measuredAt: new Date('2026-10-14T03:00:00.000Z'),
  resumesAt: new Date('2026-11-01T00:00:00.000Z'),
};

function okResend() {
  return jest.fn<Promise<Response>, [string, RequestInit]>(() =>
    Promise.resolve(new Response('{"id":"email-3"}', { status: 200 })),
  );
}

describe('ResendMailSender', () => {
  it("posts the email to Resend's API with the key as a bearer token", async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-1"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, LINKS, send).sendSignInCode(
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
      ...buildSignInCodeEmail('123456', 'pt-BR', LINKS),
    });
  });

  it('posts the sign-up code the same way, with the sign-up wording', async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-2"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, LINKS, send).sendSignUpCode(
      'bia@example.com',
      '654321',
      'es',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'bia@example.com',
      ...buildSignUpCodeEmail('654321', 'es', LINKS),
    });
  });

  it('posts the weekly digest the same way, written in the language asked for', async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-2"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, LINKS, send).sendWeeklyDigest(
      'ana@example.com',
      DIGEST,
      'pt-BR',
    );

    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'ana@example.com',
      ...buildWeeklyDigestEmail(DIGEST, 'pt-BR', LINKS),
    });
  });

  it('fails with the status only, so the recipient never reaches a log', async () => {
    const send = () =>
      Promise.resolve(new Response('{"message":"ana@example.com is invalid"}', { status: 422 }));

    await expect(
      new ResendMailSender(API_KEY, FROM, LINKS, send).sendSignInCode(
        'ana@example.com',
        '123456',
        'en',
      ),
    ).rejects.toThrow(/^Resend answered 422$/);
  });

  it('sends the welcome with replies going to the support address', async () => {
    const send = okResend();
    const welcome = { trialEndsAt: null, terms: null };

    await new ResendMailSender(API_KEY, FROM, LINKS, send, SUPPORT).sendWelcome(
      'owner@example.com',
      welcome,
      'es',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'owner@example.com',
      reply_to: SUPPORT,
      ...buildWelcomeEmail(welcome, 'es', LINKS),
    });
  });

  it('sends an account notice with replies going to the support address', async () => {
    const send = okResend();
    const notice = { kind: 'account_deleted' } as const;

    await new ResendMailSender(API_KEY, FROM, LINKS, send, SUPPORT).sendAccountNotice(
      'owner@example.com',
      notice,
      'en',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'owner@example.com',
      reply_to: SUPPORT,
      ...buildAccountNoticeEmail(notice, 'en', LINKS, SUPPORT),
    });
  });

  it('sends an invitation with replies going to the person who invited', async () => {
    const send = okResend();
    const invitation = { projectName: 'Shop', inviterEmail: 'owner@example.com' };

    await new ResendMailSender(API_KEY, FROM, LINKS, send).sendInvitation(
      'guest@example.com',
      invitation,
      'pt-BR',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'guest@example.com',
      reply_to: 'owner@example.com',
      ...buildInvitationEmail(invitation, 'pt-BR', LINKS),
    });
  });

  it('sends a quota notice with replies going to the support address', async () => {
    const send = okResend();

    await new ResendMailSender(API_KEY, FROM, LINKS, send, SUPPORT).sendQuotaNotice(
      'owner@example.com',
      PAUSED,
      'es',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: FROM,
      to: 'owner@example.com',
      reply_to: SUPPORT,
      ...buildQuotaNoticeEmail(PAUSED, 'es', LINKS, SUPPORT),
    });
  });

  it('sends a quota notice without a reply address when no support address is set', async () => {
    const send = okResend();

    await new ResendMailSender(API_KEY, FROM, LINKS, send).sendQuotaNotice(
      'owner@example.com',
      PAUSED,
      'en',
    );

    const [, init] = send.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).not.toHaveProperty('reply_to');
  });

  it('uses the global fetch by default', () => {
    expect(new ResendMailSender(API_KEY, FROM, LINKS)).toBeInstanceOf(ResendMailSender);
  });
});

describe('SesMailSender', () => {
  function recordingSes() {
    const sent: SendEmailCommandInput[] = [];
    const send = (input: SendEmailCommandInput) => {
      sent.push(input);
      return Promise.resolve({ MessageId: 'ses-1' });
    };
    return { sent, send };
  }

  it('sends the sign-in code through SES as HTML and text, from the configured sender', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send).sendSignInCode('ana@example.com', '123456', 'es');

    const email = buildSignInCodeEmail('123456', 'es', LINKS);
    expect(sent).toEqual([
      {
        FromEmailAddress: FROM,
        Destination: { ToAddresses: ['ana@example.com'] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: email.html, Charset: 'UTF-8' },
              Text: { Data: email.text, Charset: 'UTF-8' },
            },
          },
        },
      },
    ]);
  });

  it('sends the sign-up code the same way', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send).sendSignUpCode('bia@example.com', '654321', 'en');

    expect(sent[0]?.Content?.Simple?.Subject?.Data).toBe(
      buildSignUpCodeEmail('654321', 'en', LINKS).subject,
    );
    expect(sent[0]?.Destination).toEqual({ ToAddresses: ['bia@example.com'] });
  });

  it('sends the welcome through SES too', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send).sendWelcome(
      'owner@example.com',
      { trialEndsAt: null, terms: null },
      'en',
    );

    expect(sent[0]?.Destination).toEqual({ ToAddresses: ['owner@example.com'] });
  });

  it('sends an account notice with replies going to the support address', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send, SUPPORT).sendAccountNotice(
      'owner@example.com',
      { kind: 'deletion_reminder', deletionOn: new Date('2026-12-14T00:00:00.000Z') },
      'es',
    );

    expect(sent[0]).toEqual(
      expect.objectContaining({
        Destination: { ToAddresses: ['owner@example.com'] },
        ReplyToAddresses: [SUPPORT],
      }),
    );
  });

  it('sends an invitation with replies going to the person who invited', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send).sendInvitation(
      'guest@example.com',
      { projectName: 'Shop', inviterEmail: 'owner@example.com' },
      'es',
    );

    expect(sent[0]).toEqual(
      expect.objectContaining({
        Destination: { ToAddresses: ['guest@example.com'] },
        ReplyToAddresses: ['owner@example.com'],
      }),
    );
  });

  it('sends the weekly digest the same way', async () => {
    const { sent, send } = recordingSes();

    await new SesMailSender(FROM, LINKS, send).sendWeeklyDigest('ana@example.com', DIGEST, 'en');

    expect(sent[0]?.Content?.Simple?.Subject?.Data).toBe(
      buildWeeklyDigestEmail(DIGEST, 'en', LINKS).subject,
    );
  });

  it('sends a quota notice with replies going to the support address, and none without one', async () => {
    const withSupport = recordingSes();
    const withoutSupport = recordingSes();

    await new SesMailSender(FROM, LINKS, withSupport.send, SUPPORT).sendQuotaNotice(
      'owner@example.com',
      PAUSED,
      'pt-BR',
    );
    await new SesMailSender(FROM, LINKS, withoutSupport.send).sendQuotaNotice(
      'owner@example.com',
      PAUSED,
      'pt-BR',
    );

    expect(withSupport.sent[0]?.ReplyToAddresses).toEqual([SUPPORT]);
    expect(withSupport.sent[0]?.Content?.Simple?.Subject?.Data).toBe(
      buildQuotaNoticeEmail(PAUSED, 'pt-BR', LINKS, SUPPORT).subject,
    );
    expect(withoutSupport.sent[0]).not.toHaveProperty('ReplyToAddresses');
  });

  it('passes a failure of SES through, so the caller decides', async () => {
    const send = () => Promise.reject(new Error('MessageRejected'));

    await expect(
      new SesMailSender(FROM, LINKS, send).sendSignInCode('ana@example.com', '123456', 'en'),
    ).rejects.toThrow('MessageRejected');
  });

  it('sends through an SESv2 client', async () => {
    const commands: unknown[] = [];
    const client = {
      send: (command: SendEmailCommand) => {
        commands.push(command);
        return Promise.resolve({});
      },
    };

    await sesSend(client)({ FromEmailAddress: FROM, Content: {} });

    expect(commands).toEqual([expect.any(SendEmailCommand)]);
    expect(sesSend()).toBeInstanceOf(Function);
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

  it('logs a sign-up code and its language the same way, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendSignUpCode('bia@example.com', '654321', 'es');

    expect(logs).toEqual([{ message: 'mail.sign_up_code', code: '654321', language: 'es' }]);
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
        subject: buildWeeklyDigestEmail(DIGEST, 'en', LINKS).subject,
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('ana@example.com');
  });

  it('logs the kind, month and count of a quota notice, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendQuotaNotice('owner@example.com', PAUSED, 'pt-BR');

    expect(logs).toEqual([
      {
        message: 'mail.quota_notice',
        kind: 'quota_paused',
        month: '2026-10',
        events: 150_412,
        language: 'pt-BR',
      },
    ]);
  });

  it('logs whether a welcome has a trial and terms, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendWelcome(
      'owner@example.com',
      { trialEndsAt: new Date('2026-11-15T00:00:00.000Z'), terms: null },
      'en',
    );

    expect(logs).toEqual([
      { message: 'mail.welcome', trial: true, withTerms: false, language: 'en' },
    ]);
  });

  it('logs the kind and language of an account notice, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendAccountNotice(
      'owner@example.com',
      { kind: 'account_deleted' },
      'pt-BR',
    );

    expect(logs).toEqual([
      { message: 'mail.account_notice', kind: 'account_deleted', language: 'pt-BR' },
    ]);
  });

  it('logs the project and language of an invitation, never the addresses', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendInvitation(
      'guest@example.com',
      { projectName: 'Shop', inviterEmail: 'owner@example.com' },
      'en',
    );

    expect(logs).toEqual([{ message: 'mail.invitation', project: 'Shop', language: 'en' }]);
  });
});

describe('createMailSender', () => {
  it('sends through Resend whenever a key is configured', () => {
    expect(
      createMailSender({
        MAIL_PROVIDER: 'resend',
        NODE_ENV: 'production',
        RESEND_API_KEY: API_KEY,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN,
      }),
    ).toBeInstanceOf(ResendMailSender);
  });

  it('gives Resend the support address when one is configured', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"email-4"}', { status: 200 }));
    const sender = createMailSender({
      MAIL_PROVIDER: 'resend',
      NODE_ENV: 'production',
      RESEND_API_KEY: API_KEY,
      MAIL_FROM: FROM,
      DASHBOARD_ORIGIN,
      SUPPORT_EMAIL: SUPPORT,
    });

    await sender.sendQuotaNotice('owner@example.com', PAUSED, 'en');

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toMatchObject({ reply_to: SUPPORT });
    fetchSpy.mockRestore();
  });

  it('sends through SES when it is the provider, without a Resend key', () => {
    expect(
      createMailSender({
        MAIL_PROVIDER: 'ses',
        NODE_ENV: 'production',
        RESEND_API_KEY: undefined,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN,
      }),
    ).toBeInstanceOf(SesMailSender);
  });

  it('refuses SES without the dashboard the links point at', () => {
    expect(() =>
      createMailSender({
        MAIL_PROVIDER: 'ses',
        NODE_ENV: 'production',
        RESEND_API_KEY: undefined,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN: undefined,
      }),
    ).toThrow('DASHBOARD_ORIGIN is required to send e-mails');
  });

  it('logs codes only outside production', () => {
    expect(
      createMailSender({
        MAIL_PROVIDER: 'resend',
        NODE_ENV: 'development',
        RESEND_API_KEY: undefined,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN,
      }),
    ).toBeInstanceOf(LoggingMailSender);
  });

  it('refuses to send e-mails without the dashboard their links and logo point at', () => {
    expect(() =>
      createMailSender({
        MAIL_PROVIDER: 'resend',
        NODE_ENV: 'production',
        RESEND_API_KEY: API_KEY,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN: undefined,
      }),
    ).toThrow('DASHBOARD_ORIGIN is required to send e-mails');
  });

  it('refuses to start in production without a key', () => {
    expect(() =>
      createMailSender({
        MAIL_PROVIDER: 'resend',
        NODE_ENV: 'production',
        RESEND_API_KEY: undefined,
        MAIL_FROM: FROM,
        DASHBOARD_ORIGIN,
      }),
    ).toThrow('RESEND_API_KEY is required in production');
  });
});
