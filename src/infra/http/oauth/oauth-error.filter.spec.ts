import { type ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { OAuthProtocolError, RemoteMcpClosedError } from '../../../domain/errors/oauth.errors';
import { ClientRateLimitedError, InvalidRequestError } from '../errors/http-errors';
import { OAuthErrorFilter, toOAuthErrorAnswer } from './oauth-error.filter';

function hostFor(requestId = 'req-1') {
  const reply = {
    statusCode: 0,
    sentHeaders: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    headers(values: Record<string, string>) {
      Object.assign(this.sentHeaders, values);
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({ requestId }) }),
  } as unknown as ArgumentsHost;
  return { host, reply };
}

describe('toOAuthErrorAnswer', () => {
  it('answers a refused client with 401 and any other protocol error with 400', () => {
    expect(toOAuthErrorAnswer(new OAuthProtocolError('invalid_client', 'Unknown.'))).toEqual({
      status: 401,
      body: { error: 'invalid_client', error_description: 'Unknown.' },
      headers: {},
      unexpected: false,
    });
    expect(toOAuthErrorAnswer(new OAuthProtocolError('invalid_grant', 'Spent.'))).toMatchObject({
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Spent.' },
    });
  });

  it('turns a malformed body or an unsupported media type into invalid_request', () => {
    for (const exception of [
      new InvalidRequestError(),
      new HttpException('unsupported', HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    ]) {
      expect(toOAuthErrorAnswer(exception)).toEqual({
        status: 400,
        body: { error: 'invalid_request', error_description: 'The request is malformed.' },
        headers: {},
        unexpected: false,
      });
    }
  });

  it('keeps the status, the key and the retry hint of any other error', () => {
    expect(toOAuthErrorAnswer(new ClientRateLimitedError(42))).toEqual({
      status: 429,
      body: {
        error: 'rate_limited',
        error_description: 'Too many requests from this address; retry later.',
      },
      headers: { 'retry-after': '42' },
      unexpected: false,
    });
    expect(toOAuthErrorAnswer(new RemoteMcpClosedError())).toMatchObject({
      status: 404,
      body: { error: 'not_found', error_description: 'Nothing lives at this address.' },
    });
    expect(toOAuthErrorAnswer(new Error('boom'))).toMatchObject({
      status: 500,
      body: { error: 'internal_error' },
      unexpected: true,
    });
  });
});

describe('OAuthErrorFilter', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the RFC 6749 body with its status and headers, quietly when expected', () => {
    const { host, reply } = hostFor();

    new OAuthErrorFilter().catch(new ClientRateLimitedError(5), host);

    expect(reply.statusCode).toBe(429);
    expect(reply.sentHeaders).toEqual({ 'retry-after': '5' });
    expect(reply.body).toMatchObject({ error: 'rate_limited' });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('logs an unexpected error with the request id, never its details in the answer', () => {
    const { host, reply } = hostFor('req-7');

    new OAuthErrorFilter().catch(new Error('connection reset'), host);
    new OAuthErrorFilter().catch('thrown text', host);

    expect(reply.statusCode).toBe(500);
    expect(JSON.stringify(reply.body)).not.toContain('connection reset');
    expect(errorLog).toHaveBeenNthCalledWith(1, {
      message: 'http.unhandled_error',
      requestId: 'req-7',
      error: 'connection reset',
    });
    expect(errorLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ error: 'thrown text' }));
  });
});
