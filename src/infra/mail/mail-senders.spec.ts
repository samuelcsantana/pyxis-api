import { Logger } from '@nestjs/common';
import { createMailSender } from './create-mail-sender';
import { LoggingMailSender } from './logging-mail-sender';
import { RESEND_EMAILS_URL, ResendMailSender } from './resend-mail-sender';
import { buildSignInCodeEmail } from './sign-in-code-email';

const FROM = 'Pyxis <noreply@samuelsantana.dev>';
const API_KEY = 'test-api-key';

describe('buildSignInCodeEmail', () => {
  it('puts the code in the subject, the text and the HTML, in English', () => {
    const email = buildSignInCodeEmail('123456');

    expect(email.subject).toBe('123456 is your Pyxis sign-in code');
    expect(email.text).toContain('Your Pyxis sign-in code is 123456.');
    expect(email.html).toContain('>123456<');
  });

  it('escapes the code before it reaches the HTML', () => {
    const email = buildSignInCodeEmail(`<b>&"'`);

    expect(email.html).toContain('&lt;b&gt;&amp;&quot;&#39;');
    expect(email.html).not.toContain('<b>');
  });
});

describe('ResendMailSender', () => {
  it("posts the email to Resend's API with the key as a bearer token", async () => {
    const send = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(new Response('{"id":"email-1"}', { status: 200 })),
    );

    await new ResendMailSender(API_KEY, FROM, send).sendSignInCode('ana@example.com', '123456');

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
      ...buildSignInCodeEmail('123456'),
    });
  });

  it('fails with the status only, so the recipient never reaches a log', async () => {
    const send = () =>
      Promise.resolve(new Response('{"message":"ana@example.com is invalid"}', { status: 422 }));

    await expect(
      new ResendMailSender(API_KEY, FROM, send).sendSignInCode('ana@example.com', '123456'),
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

  it('logs the code for local development, never the address', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await new LoggingMailSender().sendSignInCode('ana@example.com', '123456');

    expect(logs).toEqual([{ message: 'mail.sign_in_code', code: '123456' }]);
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
