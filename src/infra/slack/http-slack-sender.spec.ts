import { Logger } from '@nestjs/common';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ProjectAlert } from '../../domain/alerts/project-alert';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor } from '../mail/email-layout';
import { summarizeProjectAlert } from '../mail/project-alert-email';
import {
  createSlackSender,
  escapeSlackText,
  type FetchLike,
  HttpSlackSender,
  SLACK_TIMEOUT_MS,
  slackAlertMessage,
  slackTestMessage,
  UnconfiguredSlackSender,
} from './http-slack-sender';
import { SLACK_MESSAGES } from './slack-messages';

const LINKS = emailLinksFor('https://dashboard.example.com');
const WEBHOOK = 'https://hooks.slack.com/services/T0001/B0002/abcdefghijklWXYZ';
const SLACK_ORIGIN = 'https://hooks.slack.com';
const PROJECT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const SPIKE: ProjectAlert = {
  kind: 'failed_writes',
  projectId: PROJECT_ID,
  projectName: 'Acme <Store> & co',
  timeZone: 'America/Sao_Paulo',
  day: '2026-11-04',
  failed: 12,
  total: 40,
  usualRate: 0.02,
};

interface Captured {
  readonly url: string;
  readonly init: RequestInit;
}

function answering(response: Response): { send: FetchLike; captured: Captured[] } {
  const captured: Captured[] = [];
  return {
    captured,
    send: (url, init) => {
      captured.push({ url, init });
      return Promise.resolve(response);
    },
  };
}

function sentBody(captured: readonly Captured[]): unknown {
  const body = captured[0]?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : null;
}

describe('escapeSlackText', () => {
  it('escapes the three characters Slack reads as markup', () => {
    expect(escapeSlackText('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });
});

describe('slackAlertMessage', () => {
  it('carries the subject as the notification text and links to the matching screen', () => {
    const message = slackAlertMessage(SPIKE, 'en', LINKS);
    const summary = summarizeProjectAlert(SPIKE, 'en', LINKS);

    expect(message.text).toBe(summary.subject);
    expect(message.text).toContain('Acme <Store> & co');
    expect(JSON.stringify(message.blocks)).toContain('*Acme &lt;Store&gt; &amp; co');
    expect(summary.url.startsWith(`https://dashboard.example.com/${PROJECT_ID}/`)).toBe(true);
    expect(JSON.stringify(message.blocks)).toContain(`<${summary.url}|`);
  });

  it.each(EMAIL_LANGUAGES)('is written in %s', (language) => {
    expect(slackAlertMessage(SPIKE, language, LINKS).blocks).toHaveLength(2);
  });
});

describe('slackTestMessage', () => {
  it.each(EMAIL_LANGUAGES)('says the project is connected, in %s', (language) => {
    const message = slackTestMessage('Shop', language);

    expect(message.text).toBe(SLACK_MESSAGES[language].connected('Shop'));
    expect(message.text).toContain('Shop');
  });
});

describe('HttpSlackSender', () => {
  it('posts the JSON message, refusing redirects and bounded by a timeout', async () => {
    const { send, captured } = answering(new Response('ok', { status: 200 }));
    const timeout = jest.spyOn(AbortSignal, 'timeout');

    await expect(new HttpSlackSender(LINKS, send).postTest(WEBHOOK, 'Shop', 'en')).resolves.toEqual(
      { outcome: 'sent' },
    );
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(WEBHOOK);
    expect(captured[0]?.init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      redirect: 'error',
    });
    expect(sentBody(captured)).toEqual(slackTestMessage('Shop', 'en'));
    expect(timeout).toHaveBeenCalledWith(SLACK_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it('posts an alert as its Slack message', async () => {
    const { send, captured } = answering(new Response('ok', { status: 200 }));

    await new HttpSlackSender(LINKS, send).postAlert(WEBHOOK, SPIKE, 'pt-BR');

    expect(sentBody(captured)).toEqual(slackAlertMessage(SPIKE, 'pt-BR', LINKS));
  });

  it.each([
    [404, 'no_service', 'no_service'],
    [410, 'channel_is_archived', 'channel_is_archived'],
    [404, '  ', '404'],
  ])('answers gone for %i %p, with what Slack said', async (status, body, reason) => {
    const { send } = answering(new Response(body, { status }));

    await expect(new HttpSlackSender(LINKS, send).postTest(WEBHOOK, 'Shop', 'en')).resolves.toEqual(
      { outcome: 'gone', reason },
    );
  });

  it('answers gone with the status when the body cannot be read', async () => {
    const response = new Response(null, { status: 404 });
    jest.spyOn(response, 'text').mockRejectedValue(new Error('stream broke'));
    const { send } = answering(response);

    await expect(new HttpSlackSender(LINKS, send).postTest(WEBHOOK, 'Shop', 'en')).resolves.toEqual(
      { outcome: 'gone', reason: '404' },
    );
  });

  it.each([400, 403, 429, 500])(
    'answers failed for %i, to be tried again tomorrow',
    async (status) => {
      const { send } = answering(new Response('invalid_payload', { status }));

      await expect(
        new HttpSlackSender(LINKS, send).postTest(WEBHOOK, 'Shop', 'en'),
      ).resolves.toEqual({ outcome: 'failed', status });
    },
  );

  it('answers failed when Slack cannot be reached', async () => {
    const send: FetchLike = () => Promise.reject(new TypeError('fetch failed'));

    await expect(new HttpSlackSender(LINKS, send).postTest(WEBHOOK, 'Shop', 'en')).resolves.toEqual(
      { outcome: 'failed', status: null },
    );
  });

  it('never calls an address that is not a Slack Incoming Webhook', async () => {
    const send = jest.fn<Promise<Response>, Parameters<FetchLike>>();

    await expect(
      new HttpSlackSender(LINKS, send).postTest('https://example.com/hook', 'Shop', 'en'),
    ).resolves.toEqual({ outcome: 'failed', status: null });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('HttpSlackSender over HTTP', () => {
  let server: Server;
  let origin: string;
  let received: { method: string; url: string; type: string; body: string }[];
  let reply: (response: ServerResponse) => void;

  beforeAll(async () => {
    server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        received.push({
          method: request.method ?? '',
          url: request.url ?? '',
          type: request.headers['content-type'] ?? '',
          body: Buffer.concat(chunks).toString('utf8'),
        });
        reply(response);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  beforeEach(() => {
    received = [];
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  function towardsStub(): FetchLike {
    return (url, init) => fetch(url.replace(SLACK_ORIGIN, origin), init);
  }

  it('posts the message as Slack receives it, and reads a 404 no_service as gone', async () => {
    reply = (response) => response.writeHead(404).end('no_service');

    await expect(
      new HttpSlackSender(LINKS, towardsStub()).postTest(WEBHOOK, 'Shop', 'de'),
    ).resolves.toEqual({ outcome: 'gone', reason: 'no_service' });
    expect(received).toEqual([
      {
        method: 'POST',
        url: '/services/T0001/B0002/abcdefghijklWXYZ',
        type: 'application/json',
        body: JSON.stringify(slackTestMessage('Shop', 'de')),
      },
    ]);
  });

  it('does not follow a redirect to another address', async () => {
    reply = (response) => response.writeHead(302, { location: `${origin}/elsewhere` }).end();

    await expect(
      new HttpSlackSender(LINKS, towardsStub()).postTest(WEBHOOK, 'Shop', 'en'),
    ).resolves.toEqual({ outcome: 'failed', status: null });
    expect(received.map(({ url }) => url)).toEqual(['/services/T0001/B0002/abcdefghijklWXYZ']);
  });

  it('answers sent for a 200 ok', async () => {
    reply = (response) => response.writeHead(200).end('ok');

    await expect(
      new HttpSlackSender(LINKS, towardsStub()).postAlert(WEBHOOK, SPIKE, 'en'),
    ).resolves.toEqual({ outcome: 'sent' });
  });
});

describe('createSlackSender', () => {
  it('answers the HTTP sender when the dashboard origin is known', () => {
    expect(createSlackSender('https://dashboard.example.com')).toBeInstanceOf(HttpSlackSender);
  });

  it('answers a sender that posts nothing, and says why, without a dashboard origin', async () => {
    const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const sender = createSlackSender(undefined);

    expect(sender).toBeInstanceOf(UnconfiguredSlackSender);
    await expect(sender.postAlert(WEBHOOK, SPIKE, 'en')).resolves.toEqual({
      outcome: 'failed',
      status: null,
    });
    await expect(sender.postTest(WEBHOOK, 'Shop', 'en')).resolves.toEqual({
      outcome: 'failed',
      status: null,
    });
    expect(errors).toHaveBeenCalledWith({ message: 'slack.dashboard_origin_missing' });
    errors.mockRestore();
  });
});
