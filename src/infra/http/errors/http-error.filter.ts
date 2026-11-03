import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { describeError } from '../../logging/describe-error';
import { toErrorAnswer } from './error-answer';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const { body, headers, unexpected } = toErrorAnswer(exception);
    if (unexpected) {
      const request = http.getRequest<FastifyRequest>();
      this.logger.error({
        message: 'http.unhandled_error',
        requestId: request.requestId,
        error: describeError(exception),
      });
    }
    void reply.status(body.status_code).headers(headers).send(body);
  }
}
