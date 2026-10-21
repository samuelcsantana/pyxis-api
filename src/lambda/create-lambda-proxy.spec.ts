import type { Context } from 'aws-lambda';
import Fastify from 'fastify';
import { ARRIVED_AT_HEADER } from '../infra/http/request-headers';
import {
  createLambdaProxy,
  isBinaryResponse,
  queryFromRawQueryString,
} from './create-lambda-proxy';

describe('queryFromRawQueryString', () => {
  it('decodes like a browser form: plus signs are spaces, repeated keys become a list', () => {
    expect(queryFromRawQueryString('q=a+b%2Cc&k=1&k=2')).toEqual({ q: 'a b,c', k: ['1', '2'] });
  });

  it('keeps a __proto__ key as data, never as the prototype', () => {
    const query = queryFromRawQueryString('__proto__=x&a=1');

    expect(Object.getPrototypeOf(query)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(query, '__proto__')?.value).toBe('x');
  });
});

describe('isBinaryResponse', () => {
  it.each([
    [{ 'content-type': 'application/json; charset=utf-8' }],
    [{ 'content-type': 'text/html' }],
    [{ 'content-type': 'application/problem+json' }],
    [{ 'content-type': 'application/javascript' }],
    [{ 'content-encoding': 'identity', 'content-type': 'text/plain' }],
    [{}],
  ])('sends %j as text', (headers) => {
    expect(isBinaryResponse(headers)).toBe(false);
  });

  it.each([
    [{ 'content-encoding': 'gzip', 'content-type': 'application/json' }],
    [{ 'content-type': 'image/png' }],
    [{ 'content-type': 'application/octet-stream' }],
  ])('sends %j as base64', (headers) => {
    expect(isBinaryResponse(headers)).toBe(true);
  });
});

function functionUrlEvent(
  rawPath: string,
  rawQueryString: string,
  queryStringParameters?: Record<string, string>,
) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString,
    ...(queryStringParameters === undefined ? {} : { queryStringParameters }),
    headers: { host: 'example.lambda-url.sa-east-1.on.aws' },
    requestContext: {
      accountId: 'anonymous',
      apiId: 'example',
      domainName: 'example.lambda-url.sa-east-1.on.aws',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '198.51.100.1',
        userAgent: 'test',
      },
      requestId: 'request-1',
      routeKey: '$default',
      stage: '$default',
      time: '06/Oct/2026:14:00:00 +0000',
      timeEpoch: 1_791_295_200_000,
    },
    isBase64Encoded: false,
  };
}

function queryRecorder() {
  const fastify = Fastify();
  const seen: unknown[] = [];
  fastify.get('/query', (request) => {
    seen.push(request.query);
    return Promise.resolve({ ok: true });
  });
  return { fastify, seen };
}

describe('createLambdaProxy', () => {
  it('reads the query from the raw query string, so a value with commas stays one value', async () => {
    const { fastify, seen } = queryRecorder();
    const proxy = createLambdaProxy(fastify);
    const steps = '[{"type":"page","path":"/"},{"type":"event","name":"signup_completed"}]';
    const raw = new URLSearchParams([
      ['from', '2026-10-08'],
      ['steps', steps],
      ['path', '/a'],
      ['path', '/b,c'],
      ['path', '/d'],
      ['source', 'a b'],
    ]).toString();

    await proxy(
      functionUrlEvent('/query', raw, {
        from: '2026-10-08',
        steps,
        path: '/a,/b,c,/d',
        source: 'a b',
      }),
      {} as Context,
    );

    expect(seen).toEqual([
      {
        from: '2026-10-08',
        steps,
        path: ['/a', '/b,c', '/d'],
        source: 'a b',
      },
    ]);
    await fastify.close();
  });

  it('stamps the time the function URL received the request, over any time the client sent', async () => {
    const fastify = Fastify();
    const seen: unknown[] = [];
    fastify.get('/arrival', (request) => {
      seen.push(request.headers[ARRIVED_AT_HEADER]);
      return Promise.resolve({ ok: true });
    });
    const proxy = createLambdaProxy(fastify);
    const event = functionUrlEvent('/arrival', '');

    await proxy(
      { ...event, headers: { ...event.headers, [ARRIVED_AT_HEADER]: '1' } },
      {} as Context,
    );

    expect(seen).toEqual(['1791295200000']);
    await fastify.close();
  });

  it('answers a request without a query string with an empty query', async () => {
    const { fastify, seen } = queryRecorder();
    const proxy = createLambdaProxy(fastify);

    await proxy(functionUrlEvent('/query', ''), {} as Context);

    expect(seen).toEqual([{}]);
    await fastify.close();
  });

  it('turns a Function URL event into a Fastify request and back', async () => {
    const fastify = Fastify();
    fastify.get('/health', () => Promise.resolve({ status: 'ok' }));
    const proxy = createLambdaProxy(fastify);

    const response = await proxy(
      {
        version: '2.0',
        routeKey: '$default',
        rawPath: '/health',
        rawQueryString: '',
        headers: { host: 'example.lambda-url.sa-east-1.on.aws' },
        requestContext: {
          accountId: 'anonymous',
          apiId: 'example',
          domainName: 'example.lambda-url.sa-east-1.on.aws',
          domainPrefix: 'example',
          http: {
            method: 'GET',
            path: '/health',
            protocol: 'HTTP/1.1',
            sourceIp: '198.51.100.1',
            userAgent: 'test',
          },
          requestId: 'request-1',
          routeKey: '$default',
          stage: '$default',
          time: '06/Oct/2026:14:00:00 +0000',
          timeEpoch: 1_791_295_200_000,
        },
        isBase64Encoded: false,
      },
      {} as Context,
    );

    expect(response).toMatchObject({
      statusCode: 200,
      body: '{"status":"ok"}',
      isBase64Encoded: false,
    });
    await fastify.close();
  });
});
