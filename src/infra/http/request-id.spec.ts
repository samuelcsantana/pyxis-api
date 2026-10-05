import Fastify, { type FastifyInstance } from 'fastify';
import { registerRequestId } from './request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('registerRequestId', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify();
    registerRequestId(fastify);
    fastify.get('/id', (request) => Promise.resolve({ requestId: request.requestId }));
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('gives the request a UUID and echoes it in X-Request-Id', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/id' });
    const header = response.headers['x-request-id'];

    expect(header).toMatch(UUID);
    expect(response.json()).toEqual({ requestId: header });
  });

  it('gives each request its own id', async () => {
    const first = await fastify.inject({ method: 'GET', url: '/id' });
    const second = await fastify.inject({ method: 'GET', url: '/id' });

    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('never takes the id from the client', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/id',
      headers: { 'x-request-id': 'chosen-by-the-client' },
    });

    expect(response.headers['x-request-id']).toMatch(UUID);
  });
});
