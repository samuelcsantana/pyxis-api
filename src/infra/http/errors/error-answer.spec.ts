import { HttpException, NotFoundException } from '@nestjs/common';
import { DomainError } from '../../../domain/errors/domain.error';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  UnknownProjectKeyError,
} from '../../../domain/errors/ingest.errors';
import { InvalidSignInCodeError, UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { InvalidRangeError } from '../../../domain/errors/query.errors';
import { UnknownCursorError } from '../../../domain/errors/subject.errors';
import { toErrorAnswer } from './error-answer';
import {
  ClientRateLimitedError,
  DashboardOriginRequiredError,
  InvalidBatchError,
  InvalidRequestError,
} from './http-errors';

class UnmappedDomainError extends DomainError {
  readonly code = 'not_mapped';

  constructor() {
    super('A rule without an HTTP status.');
  }
}

const INTERNAL = {
  body: {
    status_code: 500,
    error: 'internal_error',
    message: 'Something went wrong on our side.',
  },
  headers: {},
  unexpected: true,
};

describe('toErrorAnswer', () => {
  it.each([
    [new BatchTooLargeError(), 413, 'batch_too_large'],
    [new UnknownProjectKeyError(), 401, 'unknown_key'],
    [new OriginNotAllowedError(), 403, 'origin_not_allowed'],
    [new InvalidSignInCodeError(), 400, 'invalid_code'],
    [new UnauthenticatedError(), 401, 'unauthenticated'],
    [new InvalidRangeError(), 400, 'invalid_range'],
    [new UnknownCursorError(), 400, 'invalid_cursor'],
  ])('maps %s to its status and code', (error, status, code) => {
    expect(toErrorAnswer(error)).toEqual({
      body: { status_code: status, error: code, message: error.message },
      headers: {},
      unexpected: false,
    });
  });

  it('answers a rate-limited project with Retry-After and a CORS grant for its origin', () => {
    expect(toErrorAnswer(new ProjectRateLimitedError(17, 'https://shop.example.com'))).toEqual({
      body: { status_code: 429, error: 'rate_limited', message: expect.any(String) as string },
      headers: {
        'retry-after': '17',
        'access-control-allow-origin': 'https://shop.example.com',
        vary: 'Origin',
      },
      unexpected: false,
    });
  });

  it('treats a domain error without a status as unexpected', () => {
    expect(toErrorAnswer(new UnmappedDomainError())).toEqual(INTERNAL);
  });

  it('answers an invalid batch with 400', () => {
    expect(toErrorAnswer(new InvalidBatchError()).body).toEqual({
      status_code: 400,
      error: 'invalid_batch',
      message: 'The batch does not match the contract.',
    });
  });

  it('answers a body that breaks its schema with 400', () => {
    expect(toErrorAnswer(new InvalidRequestError()).body).toEqual({
      status_code: 400,
      error: 'invalid_request',
      message: 'The request body does not match the contract.',
    });
  });

  it('answers a dashboard call from another origin with 403', () => {
    expect(toErrorAnswer(new DashboardOriginRequiredError())).toEqual({
      body: {
        status_code: 403,
        error: 'origin_not_allowed',
        message: 'This request must come from the dashboard.',
      },
      headers: {},
      unexpected: false,
    });
  });

  it('answers a rate-limited address with 429 and Retry-After, without a CORS grant', () => {
    expect(toErrorAnswer(new ClientRateLimitedError(42))).toEqual({
      body: { status_code: 429, error: 'rate_limited', message: expect.any(String) as string },
      headers: { 'retry-after': '42' },
      unexpected: false,
    });
  });

  it('answers a Nest HTTP exception with a generic message that echoes nothing', () => {
    expect(toErrorAnswer(new NotFoundException('Cannot POST /v1/secret?email=x')).body).toEqual({
      status_code: 404,
      error: 'not_found',
      message: 'Nothing lives at this address.',
    });
  });

  it.each([
    [{ statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' }, 413, 'payload_too_large'],
    [{ statusCode: 415, code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' }, 415, 'unsupported_media_type'],
    [{ statusCode: 400, code: 'FST_ERR_CTP_INVALID_JSON_BODY' }, 400, 'invalid_request'],
  ])('maps a framework error with status %j', (error, status, code) => {
    expect(toErrorAnswer(error).body).toMatchObject({ status_code: status, error: code });
  });

  it.each([
    ['an HTTP status it does not know', new HttpException('teapot', 418)],
    ['a status that is not a number', { statusCode: '413' }],
    ['a plain error', new Error('boom')],
    ['a value that is not an object', 'boom'],
    ['null', null],
  ])('treats %s as unexpected', (_, exception) => {
    expect(toErrorAnswer(exception)).toEqual(INTERNAL);
  });
});
