import Fastify, { type FastifyInstance } from 'fastify';
import {
  DASHBOARD_PREFLIGHT_MAX_AGE_SECONDS,
  isDashboardPath,
  registerDashboardCors,
} from './dashboard-cors';

const DASHBOARD_ORIGIN = 'https://pyxis.example.com';

async function serverWith(dashboardOrigin: string | undefined): Promise<FastifyInstance> {
  const fastify = Fastify();
  registerDashboardCors(fastify, dashboardOrigin);
  fastify.get('/v1/me', () => ({ ok: true }));
  fastify.post('/v1/auth/logout', () => ({ ok: true }));
  fastify.post('/v1/batch', () => ({ ok: true }));
  await fastify.ready();
  return fastify;
}

describe('isDashboardPath', () => {
  it.each([
    '/v1/me',
    '/v1/me?fresh=1',
    '/v1/me/projects',
    '/v1/projects/p1/overview?from=a&to=b',
    '/v1/auth/request-code',
    '/v1/auth/logout?x=1',
  ])('treats %s as a dashboard path', (url) => {
    expect(isDashboardPath(url)).toBe(true);
  });

  it.each([
    '/v1/batch',
    '/health',
    '/v1/meetings',
    '/v1/authors',
    '/v1/subjects/ana',
    '/docs?path=/v1/me',
  ])('leaves %s alone', (url) => {
    expect(isDashboardPath(url)).toBe(false);
  });
});

describe('registerDashboardCors', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = await serverWith(DASHBOARD_ORIGIN);
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('lets the dashboard read the answer, never with credentials', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin: DASHBOARD_ORIGIN },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      'access-control-allow-origin': DASHBOARD_ORIGIN,
      vary: 'Origin',
    });
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('grants nothing to another origin, yet says the answer varies by origin', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toBe('Origin');
  });

  it('answers the dashboard preflight with the methods, the header and a cache age', async () => {
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/v1/auth/logout',
      headers: { origin: DASHBOARD_ORIGIN, 'access-control-request-method': 'POST' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers).toMatchObject({
      'access-control-allow-origin': DASHBOARD_ORIGIN,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'access-control-max-age': String(DASHBOARD_PREFLIGHT_MAX_AGE_SECONDS),
    });
  });

  it('closes the preflight of another origin without granting anything', async () => {
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/v1/auth/logout',
      headers: { origin: 'https://evil.example.com', 'access-control-request-method': 'POST' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-methods']).toBeUndefined();
  });

  it('leaves the ingestion route to its own CORS rules', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/batch',
      headers: { origin: DASHBOARD_ORIGIN },
    });

    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
  });

  it('grants nothing while no dashboard origin is configured', async () => {
    const unconfigured = await serverWith(undefined);

    const response = await unconfigured.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin: DASHBOARD_ORIGIN },
    });
    await unconfigured.close();

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toBe('Origin');
  });
});
