import { type ArgumentsHost, Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { OriginNotAllowedError } from '../../../domain/errors/ingest.errors';
import { HttpErrorFilter } from './http-error.filter';

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

describe('HttpErrorFilter', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the error body with its status, without logging an expected error', () => {
    const { host, reply } = hostFor();

    new HttpErrorFilter().catch(new OriginNotAllowedError('project-1', null), host);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({
      status_code: 403,
      error: 'origin_not_allowed',
      message: expect.any(String) as string,
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('logs an unexpected error with the request id and answers 500 without details', () => {
    const { host, reply } = hostFor('req-9');

    new HttpErrorFilter().catch(new Error('connection reset'), host);

    expect(reply.statusCode).toBe(500);
    expect(reply.body).toMatchObject({ error: 'internal_error' });
    expect(errorLog).toHaveBeenCalledWith({
      message: 'http.unhandled_error',
      requestId: 'req-9',
      error: 'connection reset',
    });
  });

  it('logs a failed database query by its code, never by the values it sent', () => {
    const { host, reply } = hostFor('req-5');
    const cause = Object.assign(new Error('unsupported Unicode escape sequence'), {
      code: '22P05',
    });
    const failed = new DrizzleQueryError(
      'insert into "events" ("properties") values ($1)',
      ['{"plan":"pro\\u0000"}'],
      cause,
    );

    new HttpErrorFilter().catch(failed, host);

    expect(reply.statusCode).toBe(500);
    expect(errorLog).toHaveBeenCalledWith({
      message: 'http.unhandled_error',
      requestId: 'req-5',
      error: 'database query failed (22P05)',
    });
  });

  it('logs something thrown that is not an Error', () => {
    const { host } = hostFor();

    new HttpErrorFilter().catch('raw failure', host);

    expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ error: 'raw failure' }));
  });
});
