import Fastify, { type FastifyInstance } from 'fastify';
import {
  DEFAULT_CACHE_CONTROL,
  SECURITY_HEADERS,
  registerSecurityHeaders,
} from './security-headers';

describe('registerSecurityHeaders', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify();
    registerSecurityHeaders(fastify);
    fastify.get('/plain', () => Promise.resolve({ ok: true }));
    fastify.get('/cached', (_request, reply) =>
      reply.header('Cache-Control', 'public, max-age=60').send({ ok: true }),
    );
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('adds every security header to a response', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/plain' });

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers[name.toLowerCase()]).toBe(value);
    }
  });

  it('forbids caching when the route sets no Cache-Control', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/plain' });

    expect(response.headers['cache-control']).toBe(DEFAULT_CACHE_CONTROL);
  });

  it('keeps the Cache-Control a route sets itself', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/cached' });

    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('adds the headers to a 404 as well', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
