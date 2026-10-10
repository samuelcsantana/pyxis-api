import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../domain/errors/domain.error';
import { ProjectRateLimitedError } from '../../../domain/errors/ingest.errors';
import type { ErrorResponse } from '../ingest/ingest.schemas';
import {
  ClientRateLimitedError,
  DashboardOriginRequiredError,
  InvalidBatchError,
  InvalidRequestError,
} from './http-errors';

export interface ErrorAnswer {
  readonly body: ErrorResponse;
  readonly headers: Readonly<Record<string, string>>;
  readonly unexpected: boolean;
}

const DOMAIN_STATUSES: ReadonlyMap<string, number> = new Map([
  ['batch_too_large', HttpStatus.PAYLOAD_TOO_LARGE],
  ['unknown_key', HttpStatus.UNAUTHORIZED],
  ['origin_not_allowed', HttpStatus.FORBIDDEN],
  ['rate_limited', HttpStatus.TOO_MANY_REQUESTS],
  ['invalid_code', HttpStatus.BAD_REQUEST],
  ['unauthenticated', HttpStatus.UNAUTHORIZED],
  ['session_not_found', HttpStatus.NOT_FOUND],
  ['invalid_range', HttpStatus.BAD_REQUEST],
  ['invalid_cursor', HttpStatus.BAD_REQUEST],
  ['project_not_found', HttpStatus.NOT_FOUND],
]);

const HTTP_ERRORS: ReadonlyMap<number, { readonly error: string; readonly message: string }> =
  new Map([
    [HttpStatus.BAD_REQUEST, { error: 'invalid_request', message: 'The request is malformed.' }],
    [HttpStatus.NOT_FOUND, { error: 'not_found', message: 'Nothing lives at this address.' }],
    [
      HttpStatus.PAYLOAD_TOO_LARGE,
      { error: 'payload_too_large', message: 'The request body is too large.' },
    ],
    [
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      { error: 'unsupported_media_type', message: 'Send JSON as text/plain or application/json.' },
    ],
  ]);

const INTERNAL_ERROR: ErrorAnswer = {
  body: {
    status_code: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'internal_error',
    message: 'Something went wrong on our side.',
  },
  headers: {},
  unexpected: true,
};

const RETRY_AFTER_HEADER = 'retry-after';

function answer(
  statusCode: number,
  error: string,
  message: string,
  headers: Readonly<Record<string, string>> = {},
): ErrorAnswer {
  return { body: { status_code: statusCode, error, message }, headers, unexpected: false };
}

function statusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  if (typeof exception === 'object' && exception !== null && 'statusCode' in exception) {
    const { statusCode } = exception;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }
  return undefined;
}

function domainAnswer(exception: DomainError): ErrorAnswer {
  const status = DOMAIN_STATUSES.get(exception.code);
  if (status === undefined) {
    return INTERNAL_ERROR;
  }
  if (exception instanceof ProjectRateLimitedError) {
    return answer(status, exception.code, exception.message, {
      [RETRY_AFTER_HEADER]: String(exception.retryAfterSeconds),
      'access-control-allow-origin': exception.allowedOrigin,
      vary: 'Origin',
    });
  }
  return answer(status, exception.code, exception.message);
}

export function toErrorAnswer(exception: unknown): ErrorAnswer {
  if (exception instanceof DomainError) {
    return domainAnswer(exception);
  }
  if (exception instanceof InvalidBatchError || exception instanceof InvalidRequestError) {
    return answer(HttpStatus.BAD_REQUEST, exception.code, exception.message);
  }
  if (exception instanceof DashboardOriginRequiredError) {
    return answer(HttpStatus.FORBIDDEN, exception.code, exception.message);
  }
  if (exception instanceof ClientRateLimitedError) {
    return answer(HttpStatus.TOO_MANY_REQUESTS, exception.code, exception.message, {
      [RETRY_AFTER_HEADER]: String(exception.retryAfterSeconds),
    });
  }
  const status = statusOf(exception);
  const known = status === undefined ? undefined : HTTP_ERRORS.get(status);
  return status === undefined || known === undefined
    ? INTERNAL_ERROR
    : answer(status, known.error, known.message);
}
