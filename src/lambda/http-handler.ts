import type { PromiseHandler } from '@fastify/aws-lambda';
import { Logger } from '@nestjs/common';
import type { Context } from 'aws-lambda';
import { comesFromEdge } from './edge-secret';
import { isFunctionUrlEvent } from './lambda-events';
import { once } from './once';

export interface HttpHandlerDependencies {
  readonly loadParameters: () => Promise<unknown>;
  readonly buildProxy: () => Promise<PromiseHandler>;
  readonly edgeSecret: () => string | undefined;
}

export const FORBIDDEN_RESPONSE = {
  statusCode: 403,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    status_code: 403,
    error: 'forbidden',
    message: 'Requests must come through the API domain.',
  }),
};

export const UNEXPECTED_EVENT_RESPONSE = { statusCode: 400, body: '' };

const logger = new Logger('LambdaHttp');

export function createHttpHandler(
  dependencies: HttpHandlerDependencies,
): (event: unknown, context: Context) => Promise<unknown> {
  const parametersOnce = once(dependencies.loadParameters);
  const proxyOnce = once(dependencies.buildProxy);
  return async (event, context) => {
    await parametersOnce();
    if (!isFunctionUrlEvent(event)) {
      logger.error({ message: 'lambda.unexpected_event' });
      return UNEXPECTED_EVENT_RESPONSE;
    }
    if (!comesFromEdge(event.headers, dependencies.edgeSecret())) {
      return FORBIDDEN_RESPONSE;
    }
    const proxy = await proxyOnce();
    return proxy(event, context);
  };
}
