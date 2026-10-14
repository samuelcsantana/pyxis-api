import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type {
  HandleBillingEventCommand,
  HandleBillingEventUseCase,
} from '../../../usecases/billing/handle-billing-event.usecase';
import { InvalidRequestError } from '../errors/http-errors';
import { BillingWebhookController } from './billing-webhook.controller';

function controller() {
  const commands: HandleBillingEventCommand[] = [];
  const useCase = {
    execute: (command: HandleBillingEventCommand) => {
      commands.push(command);
      return Promise.resolve('applied' as const);
    },
  } as unknown as HandleBillingEventUseCase;
  return { commands, controller: new BillingWebhookController(useCase) };
}

function request(rawBody: Buffer | undefined): RawBodyRequest<FastifyRequest> {
  return { rawBody } as RawBodyRequest<FastifyRequest>;
}

describe('BillingWebhookController', () => {
  it('hands the raw body and the signature to the use case', async () => {
    const { commands, controller: webhook } = controller();
    const rawBody = Buffer.from('{"id":"evt_1"}');

    await expect(webhook.receive(request(rawBody), 't=1,v1=abc')).resolves.toEqual({
      received: 'applied',
    });
    await webhook.receive(request(rawBody), undefined);

    expect(commands).toEqual([
      { rawBody, signature: 't=1,v1=abc' },
      { rawBody, signature: null },
    ]);
  });

  it('refuses a request whose body was not kept raw, which means it was not JSON', async () => {
    const { commands, controller: webhook } = controller();

    await expect(webhook.receive(request(undefined), 't=1,v1=abc')).rejects.toBeInstanceOf(
      InvalidRequestError,
    );
    expect(commands).toEqual([]);
  });
});
