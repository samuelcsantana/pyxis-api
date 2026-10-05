import type { PromiseHandler } from '@fastify/aws-lambda';
import { Logger } from '@nestjs/common';
import type { Context } from 'aws-lambda';
import { EDGE_SECRET_HEADER } from './edge-secret';
import { createHttpHandler, FORBIDDEN_RESPONSE, UNEXPECTED_EVENT_RESPONSE } from './http-handler';

const CONTEXT = {} as Context;

function urlEvent(headers: Record<string, string> = {}) {
  return { rawPath: '/health', headers, requestContext: { http: { method: 'GET' } } };
}

function setup() {
  const loadParameters = jest.fn(() => Promise.resolve());
  const proxy = jest.fn(() => Promise.resolve({ statusCode: 200, body: '{"status":"ok"}' }));
  const buildProxy = jest.fn(() => Promise.resolve(proxy as unknown as PromiseHandler));
  const handler = createHttpHandler({
    loadParameters,
    buildProxy,
    edgeSecret: () => 'edge-secret',
  });
  return { handler, loadParameters, buildProxy, proxy };
}

describe('createHttpHandler', () => {
  let errors: jest.SpyInstance;

  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the parameters, builds the app once and hands it the requests from the edge', async () => {
    const { handler, loadParameters, buildProxy, proxy } = setup();
    const event = urlEvent({ [EDGE_SECRET_HEADER]: 'edge-secret' });

    expect(await handler(event, CONTEXT)).toEqual({ statusCode: 200, body: '{"status":"ok"}' });
    await handler(event, CONTEXT);

    expect(loadParameters).toHaveBeenCalledTimes(1);
    expect(buildProxy).toHaveBeenCalledTimes(1);
    expect(proxy).toHaveBeenCalledWith(event, CONTEXT);
  });

  it.each([
    ['without the edge secret', {}],
    ['with a wrong edge secret', { [EDGE_SECRET_HEADER]: 'guess' }],
  ])('answers 403 to a request %s, without building the app', async (_, headers) => {
    const { handler, buildProxy } = setup();

    expect(await handler(urlEvent(headers), CONTEXT)).toBe(FORBIDDEN_RESPONSE);
    expect(buildProxy).not.toHaveBeenCalled();
    expect(JSON.parse(FORBIDDEN_RESPONSE.body)).toMatchObject({
      status_code: 403,
      error: 'forbidden',
    });
  });

  it('answers 400 and logs an event that is not a Function URL request', async () => {
    const { handler, buildProxy } = setup();

    expect(await handler({ source: 'aws.events' }, CONTEXT)).toBe(UNEXPECTED_EVENT_RESPONSE);
    expect(buildProxy).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith({ message: 'lambda.unexpected_event' });
  });
});
