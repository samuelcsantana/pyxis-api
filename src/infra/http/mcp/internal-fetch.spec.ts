import Fastify, { type FastifyInstance } from 'fastify';
import { createInternalFetch, ForeignAddressError } from './internal-fetch';

const API_ORIGIN = 'https://api.example.com';

interface SeenRequest {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
}

async function apiAnswering(): Promise<{ fastify: FastifyInstance; seen: SeenRequest[] }> {
  const seen: SeenRequest[] = [];
  const fastify = Fastify();
  fastify.all('/v1/me', (request, reply) => {
    seen.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    return reply.header('x-repeated', ['one', 'two']).send({ projects: [] });
  });
  fastify.get('/v1/empty', (_request, reply) => reply.status(204).send());
  fastify.get('/v1/slow', () => new Promise(() => undefined));
  await fastify.ready();
  return { fastify, seen };
}

describe('createInternalFetch', () => {
  it('reads a route of this API in process, with the headers the tool sent', async () => {
    const { fastify, seen } = await apiAnswering();
    const fetch = createInternalFetch(fastify, API_ORIGIN);

    const response = await fetch(`${API_ORIGIN}/v1/me?from=2026-10-01&to=2026-10-15`, {
      headers: { authorization: 'Bearer pyxis_oat_x' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [] });
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-repeated')).toBe('one, two');
    expect(seen).toEqual([
      {
        method: 'GET',
        url: '/v1/me?from=2026-10-01&to=2026-10-15',
        authorization: 'Bearer pyxis_oat_x',
      },
    ]);
  });

  it('only ever reads, whatever method a tool asks for', async () => {
    const { fastify, seen } = await apiAnswering();

    await createInternalFetch(fastify, API_ORIGIN)(`${API_ORIGIN}/v1/me`, { method: 'DELETE' });

    expect(seen.map(({ method }) => method)).toEqual(['GET']);
  });

  it('answers a route with no content without a body', async () => {
    const { fastify } = await apiAnswering();

    const response = await createInternalFetch(fastify, API_ORIGIN)(`${API_ORIGIN}/v1/empty`, {});

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it('refuses an address outside this API without calling anything', async () => {
    const { fastify, seen } = await apiAnswering();

    await expect(
      createInternalFetch(fastify, API_ORIGIN)('https://elsewhere.example.com/v1/me', {}),
    ).rejects.toThrow(new ForeignAddressError('https://elsewhere.example.com'));
    expect(seen).toEqual([]);
  });

  it('gives up when the tool stops waiting', async () => {
    const { fastify } = await apiAnswering();
    const controller = new AbortController();
    const reason = Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' });

    const pending = createInternalFetch(fastify, API_ORIGIN)(`${API_ORIGIN}/v1/slow`, {
      signal: controller.signal,
    });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it('gives up at once when the tool had already stopped waiting', async () => {
    const { fastify, seen } = await apiAnswering();
    const controller = new AbortController();
    controller.abort('not an error');

    await expect(
      createInternalFetch(fastify, API_ORIGIN)(`${API_ORIGIN}/v1/me`, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('The request was aborted.');
    expect(seen).toEqual([]);
  });

  it('passes on a failure of the route itself', async () => {
    const { fastify } = await apiAnswering();
    const failure = new Error('inject failed');
    jest.spyOn(fastify, 'inject').mockImplementation(() => Promise.reject(failure) as never);

    await expect(
      createInternalFetch(fastify, API_ORIGIN)(`${API_ORIGIN}/v1/me`, {
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(failure);
  });
});
