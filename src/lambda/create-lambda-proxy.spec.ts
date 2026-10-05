import type { Context } from 'aws-lambda';
import Fastify from 'fastify';
import { createLambdaProxy, isBinaryResponse } from './create-lambda-proxy';

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

describe('createLambdaProxy', () => {
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
