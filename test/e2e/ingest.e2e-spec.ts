import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import { PROJECT_RATE_LIMITER } from '../../src/domain/services/project-rate-limiter';
import { FixedWindowProjectRateLimiter } from '../../src/infra/rate-limit/fixed-window-project-rate-limiter';
import { CLIENT_BATCHES_PER_WINDOW } from '../../src/infra/http/ingest/client-address-throttler.guard';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER } from './env-setup';

const SHOP_ID = 'c5f3e4d6-7d80-4192-a314-c5d6e7f8091a';
const ORIGIN = 'https://shop.example.com';
const KEY = `${PUBLIC_KEY_PREFIX}${'E'.repeat(32)}`;
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

let clientCounter = 0;

function nextClientIp(): string {
  clientCounter += 1;
  return `198.51.100.${String(clientCounter)}`;
}

function event(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `9f1c2b3a-1d2e-4f5a-8b6c-${String(index).padStart(12, '0')}`,
    name: 'page_view',
    occurred_at: '2026-10-06T14:00:05.000Z',
    session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
    path: '/pricing',
    ...overrides,
  };
}

function batch(events: unknown[], overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events, ...overrides });
}

interface SendOptions {
  readonly body: string;
  readonly origin?: string | null;
  readonly contentType?: string;
  readonly userAgent?: string;
  readonly clientIp?: string;
}

describe('POST /v1/batch', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const send = (options: SendOptions) =>
    app.inject({
      method: 'POST',
      url: '/v1/batch',
      payload: options.body,
      headers: {
        'content-type': options.contentType ?? 'text/plain;charset=UTF-8',
        'user-agent': options.userAgent ?? SAFARI_IPHONE,
        [E2E_CLIENT_IP_HEADER]: options.clientIp ?? nextClientIp(),
        ...(options.origin === null ? {} : { origin: options.origin ?? ORIGIN }),
      },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`
      INSERT INTO projects (id, name, allowed_origins) VALUES (${SHOP_ID}, 'Shop', ${[ORIGIN]})
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key) VALUES (${SHOP_ID}, 'public', ${KEY})
    `;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('stores a text/plain batch, answers 202 with the counts and lets the origin read it', async () => {
    const response = await send({ body: batch([event(1), event(2)]) });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: 2, duplicates: 0, rejected: 0 });
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.headers.vary).toBe('Origin');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('counts a resent batch as duplicates', async () => {
    await send({ body: batch([event(11), event(12)]) });

    const response = await send({ body: batch([event(11), event(12)]) });

    expect(response.json()).toEqual({ accepted: 0, duplicates: 2, rejected: 0 });
  });

  it('accepts application/json too', async () => {
    const response = await send({ body: batch([event(21)]), contentType: 'application/json' });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: 1, duplicates: 0, rejected: 0 });
  });

  it('rejects one invalid event and stores the rest of the batch', async () => {
    const response = await send({
      body: batch([event(31), event(32, { name: 'Not Valid' }), event(33)]),
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: 2, duplicates: 0, rejected: 1 });
  });

  it('rejects every event of a bot', async () => {
    const response = await send({
      body: batch([event(41), event(42)]),
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: 0, duplicates: 0, rejected: 2 });
  });

  it('stores neither the user agent nor the address in the row', async () => {
    await send({ body: batch([event(51)]), clientIp: '203.0.113.99' });

    const [row] = await owner<Record<string, unknown>[]>`
      SELECT * FROM events WHERE project_id = ${SHOP_ID} AND id = ${String(event(51).id)}
    `;
    const stored = JSON.stringify(row);
    expect(row).toMatchObject({ device_type: 'mobile', browser: 'safari', os: 'ios' });
    expect(stored).not.toContain('Mozilla');
    expect(stored).not.toContain('203.0.113.99');
  });

  it.each([
    ['an unknown top-level field', batch([event(61)], { extra: true })],
    ['zero events', batch([])],
    ['a body that is not JSON', '{"key":'],
  ])('answers 400 to %s, without letting the origin read it', async (_, body) => {
    const response = await send({ body });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      status_code: 400,
      error: expect.any(String) as string,
      message: expect.any(String) as string,
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers 413 to more than 50 events', async () => {
    const events = Array.from({ length: 51 }, (_, index) => event(100 + index));

    const response = await send({ body: batch(events) });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ status_code: 413, error: 'batch_too_large' });
  });

  it('answers 413 to a body over 32,768 bytes, in the same error shape', async () => {
    const response = await send({ body: batch([event(71, { path: `/${'a'.repeat(40_000)}` })]) });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ status_code: 413, error: 'payload_too_large' });
  });

  it('answers 401 to an unknown key', async () => {
    const response = await send({
      body: batch([event(81)], { key: `${PUBLIC_KEY_PREFIX}${'U'.repeat(32)}` }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ status_code: 401, error: 'unknown_key' });
  });

  it.each([
    ['another origin', 'https://evil.example.com'],
    ['no origin', null],
  ])('answers 403 to %s, without letting it read the answer', async (_, origin) => {
    const response = await send({ body: batch([event(91)]), origin });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status_code: 403, error: 'origin_not_allowed' });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it(`answers 429 with Retry-After after ${String(CLIENT_BATCHES_PER_WINDOW)} batches from one address`, async () => {
    const clientIp = '192.0.2.200';
    const unknownKey = batch([event(95)], { key: `${PUBLIC_KEY_PREFIX}${'T'.repeat(32)}` });
    for (let request = 0; request < CLIENT_BATCHES_PER_WINDOW; request += 1) {
      await send({ body: unknownKey, clientIp });
    }

    const response = await send({ body: unknownKey, clientIp });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the CORS preflight for any origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/batch',
      headers: { origin: 'https://anywhere.example.com', 'access-control-request-method': 'POST' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers).toMatchObject({
      'access-control-allow-origin': 'https://anywhere.example.com',
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'Content-Type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    });
  });

  it('answers a preflight without an origin with no CORS grant', async () => {
    const response = await app.inject({ method: 'OPTIONS', url: '/v1/batch' });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('POST /v1/batch over the project limit', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    app = await createTestApp((builder) =>
      builder.overrideProvider(PROJECT_RATE_LIMITER).useValue(new FixedWindowProjectRateLimiter(1)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers 429 with Retry-After and still lets the allowed origin read it', async () => {
    const request = (index: number) =>
      app.inject({
        method: 'POST',
        url: '/v1/batch',
        payload: batch([event(index)]),
        headers: {
          'content-type': 'text/plain',
          origin: ORIGIN,
          [E2E_CLIENT_IP_HEADER]: '192.0.2.10',
        },
      });

    expect((await request(201)).statusCode).toBe(202);
    const limited = await request(202);

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(limited.headers.vary).toBe('Origin');
  });
});
