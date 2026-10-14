import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  type BillingEventOutcome,
  HandleBillingEventUseCase,
} from '../../../usecases/billing/handle-billing-event.usecase';
import { InvalidRequestError } from '../errors/http-errors';

export const BILLING_WEBHOOK_PATH = '/v1/billing/stripe/webhook';

export interface BillingEventAnswer {
  readonly received: BillingEventOutcome;
}

@Controller()
export class BillingWebhookController {
  constructor(private readonly handleEvent: HandleBillingEventUseCase) {}

  @Post(BILLING_WEBHOOK_PATH)
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receive(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<BillingEventAnswer> {
    if (request.rawBody === undefined) {
      throw new InvalidRequestError();
    }
    return {
      received: await this.handleEvent.execute({
        rawBody: request.rawBody,
        signature: signature ?? null,
      }),
    };
  }
}
