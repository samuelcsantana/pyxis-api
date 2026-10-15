import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OAuthProtocolError } from '../../../domain/errors/oauth.errors';
import { toErrorAnswer } from '../errors/error-answer';

export interface OAuthErrorBody {
  readonly error: string;
  readonly error_description: string;
}

export interface OAuthErrorAnswer {
  readonly status: number;
  readonly body: OAuthErrorBody;
  readonly headers: Readonly<Record<string, string>>;
  readonly unexpected: boolean;
}

const INVALID_REQUEST = 'invalid_request';
const MALFORMED_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNSUPPORTED_MEDIA_TYPE,
]);
const RATE_LIMITED_DESCRIPTION = 'Too many requests from this address; retry later.';
const TOO_MANY_REQUESTS: number = HttpStatus.TOO_MANY_REQUESTS;

function protocolAnswer(exception: OAuthProtocolError): OAuthErrorAnswer {
  const status =
    exception.code === 'invalid_client' ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_REQUEST;
  return {
    status,
    body: { error: exception.code, error_description: exception.message },
    headers: {},
    unexpected: false,
  };
}

export function toOAuthErrorAnswer(exception: unknown): OAuthErrorAnswer {
  if (exception instanceof OAuthProtocolError) {
    return protocolAnswer(exception);
  }
  const { body, headers, unexpected } = toErrorAnswer(exception);
  if (MALFORMED_STATUSES.has(body.status_code)) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { error: INVALID_REQUEST, error_description: 'The request is malformed.' },
      headers,
      unexpected,
    };
  }
  const description =
    body.status_code === TOO_MANY_REQUESTS ? RATE_LIMITED_DESCRIPTION : body.message;
  return {
    status: body.status_code,
    body: { error: body.error, error_description: description },
    headers,
    unexpected,
  };
}

@Catch()
export class OAuthErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const answer = toOAuthErrorAnswer(exception);
    if (answer.unexpected) {
      this.logger.error({
        message: 'http.unhandled_error',
        requestId: http.getRequest<FastifyRequest>().requestId,
        error: exception instanceof Error ? exception.message : String(exception),
      });
    }
    void reply.status(answer.status).headers(answer.headers).send(answer.body);
  }
}
