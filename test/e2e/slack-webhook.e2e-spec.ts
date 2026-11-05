import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SECRET_BOX } from '../../src/domain/services/secret-box';
import { SLACK_SENDER } from '../../src/domain/slack/slack-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { SLACK_TESTS_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { CryptoRandomSource } from '../../src/infra/random/crypto-random-source';
import { AesGcmSecretBox, parseSecretBoxKeys } from '../../src/infra/security/aes-gcm-secret-box';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingSlackSender } from '../../src/test-utils/in-memory-slack';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-05T15:00:00.000Z');
const OWNER_ID = 'e8c00000-0000-4000-8000-000000000001';
const MEMBER_ID = 'e8c00000-0000-4000-8000-000000000002';
const ACCOUNT_ID = 'e8c00000-0000-4000-8000-000000000011';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-slack-owner-session`;
const MEMBER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-slack-member-session`;
const WEBHOOK = 'https://hooks.slack.com/services/T0E2E/B0E2E/e2esecretpartWXYZ';
const KEYS = `1:${Buffer.alloc(32, 7).toString('base64')}`;
const MASKED = {
  masked_url: 'hooks.slack.com/…/WXYZ',
  connected_at: NOW.toISOString(),
  broken_at: null,
  broken_reason: null,
};

interface Call {
  readonly cookie?: string | null;
  readonly origin?: string | null;
  readonly payload?: object;
  readonly clientIp?: string;
}

describe('the Slack webhook of a project, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';
  let clientIpSequence = 0;
  const slack = new RecordingSlackSender();

  const call = (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, options: Call = {}) => {
    clientIpSequence += 1;
    const cookie = options.cookie === undefined ? OWNER_COOKIE : options.cookie;
    const origin = options.origin === undefined ? E2E_DASHBOARD_ORIGIN : options.origin;
    return app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: {
        [E2E_CLIENT_IP_HEADER]: options.clientIp ?? `198.51.100.${String(clientIpSequence % 250)}`,
        ...(cookie === null ? {} : { cookie }),
        ...(origin === null ? {} : { origin }),
      },
    });
  };
  const webhookUrl = () => `/v1/projects/${projectId}/slack-webhook`;
  const setStatus = (status: string) =>
    owner`UPDATE accounts SET status = ${status} WHERE id = ${ACCOUNT_ID}`;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, 'slack-owner@example.com', 'pt-BR'),
             (${MEMBER_ID}, 'slack-member@example.com', 'en')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-slack-owner-session')}, ${NOW}, ${NOW}),
             (${MEMBER_ID}, ${sha256Hex('e2e-slack-member-session')}, ${NOW}, ${NOW})`;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(SECRET_BOX)
        .useValue(new AesGcmSecretBox(parseSecretBoxKeys(KEYS), new CryptoRandomSource()))
        .overrideProvider(SLACK_SENDER)
        .useValue(slack),
    );
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      payload: {
        name: 'Slack shop',
        allowed_origins: ['https://slack-shop.example.com'],
        timezone: 'UTC',
        currency: 'USD',
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
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner.end();
  });

  afterEach(async () => {
    await setStatus('active');
    await owner`DELETE FROM project_slack_webhooks WHERE project_id = ${projectId}`;
    slack.posted.length = 0;
    slack.answer(WEBHOOK, { outcome: 'sent' });
  });

  it('stores the address encrypted and answers it only masked', async () => {
    const set = await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });

    expect(set.statusCode).toBe(200);
    expect(set.json()).toEqual({ webhook: MASKED });
    const shown = await call('GET', webhookUrl(), { origin: null });
    expect(shown.json()).toEqual({ webhook: MASKED });
    const rows = await owner<{ sealed_url: string; hint: string }[]>`
      SELECT sealed_url, hint FROM project_slack_webhooks WHERE project_id = ${projectId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hint).toBe('WXYZ');
    expect(rows[0]?.sealed_url).toMatch(/^v1\./);
    expect(rows[0]?.sealed_url).not.toContain('hooks.slack.com');
    expect(rows[0]?.sealed_url).not.toContain('e2esecretpart');
  });

  it('answers null before a webhook is set', async () => {
    const shown = await call('GET', webhookUrl(), { origin: null });

    expect(shown.statusCode).toBe(200);
    expect(shown.json()).toEqual({ webhook: null });
  });

  it.each([
    'https://example.com/services/T0E2E/B0E2E/e2esecretpart',
    'http://hooks.slack.com/services/T0E2E/B0E2E/e2esecretpart',
    'https://hooks.slack.com/services/T0E2E/B0E2E/e2esecretpart?then=https://example.com',
  ])('refuses %s with invalid_slack_webhook', async (url) => {
    const response = await call('PUT', webhookUrl(), { payload: { url } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_slack_webhook' });
  });

  it('refuses unknown fields', async () => {
    const response = await call('PUT', webhookUrl(), {
      payload: { url: WEBHOOK, channel: '#general' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('is Pro only: plan_required on the free plan', async () => {
    await setStatus('free');

    const response = await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'plan_required' });
  });

  it('keeps the stored address of an account that left Pro, visible and removable', async () => {
    await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });
    await setStatus('free');

    const shown = await call('GET', webhookUrl(), { origin: null });
    expect(shown.json()).toEqual({ webhook: MASKED });
    const tested = await call('POST', `${webhookUrl()}/test`);
    expect(tested.statusCode).toBe(403);
    const removed = await call('DELETE', webhookUrl());
    expect(removed.statusCode).toBe(204);
    expect((await call('GET', webhookUrl(), { origin: null })).json()).toEqual({ webhook: null });
  });

  it('answers project_not_found to a person who is not the owner', async () => {
    for (const [method, url] of [
      ['GET', webhookUrl()],
      ['PUT', webhookUrl()],
      ['DELETE', webhookUrl()],
      ['POST', `${webhookUrl()}/test`],
    ] as const) {
      const response = await call(method, url, {
        cookie: MEMBER_COOKIE,
        ...(method === 'PUT' ? { payload: { url: WEBHOOK } } : {}),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: 'project_not_found' });
    }
  });

  it('refuses a change that did not come from the dashboard, and a call with no session', async () => {
    const foreign = await call('PUT', webhookUrl(), {
      origin: 'https://evil.example.com',
      payload: { url: WEBHOOK },
    });
    const anonymous = await call('GET', webhookUrl(), { cookie: null, origin: null });

    expect(foreign.statusCode).toBe(403);
    expect(anonymous.statusCode).toBe(401);
  });

  it('posts the test message in the language of the admin', async () => {
    await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });

    const response = await call('POST', `${webhookUrl()}/test`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: 'sent' });
    expect(slack.posted).toEqual([
      { webhookUrl: WEBHOOK, alert: null, projectName: 'Slack shop', language: 'pt-BR' },
    ]);
  });

  it('marks the webhook broken when Slack answers it is gone, and clears it when replaced', async () => {
    await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });
    slack.answer(WEBHOOK, { outcome: 'gone', reason: 'no_service' });

    const response = await call('POST', `${webhookUrl()}/test`);

    expect(response.json()).toEqual({ outcome: 'broken' });
    expect((await call('GET', webhookUrl(), { origin: null })).json()).toEqual({
      webhook: { ...MASKED, broken_at: NOW.toISOString(), broken_reason: 'no_service' },
    });
    await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });
    expect((await call('GET', webhookUrl(), { origin: null })).json()).toEqual({
      webhook: MASKED,
    });
  });

  it('answers slack_webhook_not_found to a test or a removal with nothing set', async () => {
    const tested = await call('POST', `${webhookUrl()}/test`);
    const removed = await call('DELETE', webhookUrl());

    expect(tested.statusCode).toBe(404);
    expect(tested.json()).toMatchObject({ error: 'slack_webhook_not_found' });
    expect(removed.statusCode).toBe(404);
    expect(removed.json()).toMatchObject({ error: 'slack_webhook_not_found' });
  });

  it('limits one address to ten tests every fifteen minutes', async () => {
    await call('PUT', webhookUrl(), { payload: { url: WEBHOOK } });
    const clientIp = '203.0.113.88';

    for (let attempt = 0; attempt < SLACK_TESTS_PER_WINDOW; attempt += 1) {
      expect((await call('POST', `${webhookUrl()}/test`, { clientIp })).statusCode).toBe(200);
    }
    const limited = await call('POST', `${webhookUrl()}/test`, { clientIp });

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: 'rate_limited' });
    expect(slack.posted).toHaveLength(SLACK_TESTS_PER_WINDOW);
  });
});

describe('the Slack webhook routes on a server with no encryption key', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'slack-owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-slack-owner-session')}, ${NOW}, ${NOW})`;
    const [project] = await owner<{ id: string }[]>`
      INSERT INTO projects (name, account_id) VALUES ('Unkeyed shop', ${ACCOUNT_ID}) RETURNING id`;
    projectId = project?.id ?? '';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id = ${OWNER_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('answers slack_unavailable instead of storing the address in the clear', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/slack-webhook`,
      payload: { url: WEBHOOK },
      headers: {
        [E2E_CLIENT_IP_HEADER]: '198.51.100.251',
        cookie: OWNER_COOKIE,
        origin: E2E_DASHBOARD_ORIGIN,
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'slack_unavailable' });
    const rows = await owner`SELECT 1 FROM project_slack_webhooks WHERE project_id = ${projectId}`;
    expect(rows).toEqual([]);
  });
});
