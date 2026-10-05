import { createFastifyAdapter } from './fastify-adapter.options';

describe('createFastifyAdapter', () => {
  it('ignores X-Forwarded-For when resolving the client address', async () => {
    const fastify = createFastifyAdapter().getInstance();
    fastify.get('/ip', async (request) => ({ ip: request.ip }));

    const response = await fastify.inject({
      method: 'GET',
      url: '/ip',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });

    expect(response.json()).toEqual({ ip: '127.0.0.1' });
    await fastify.close();
  });
});
