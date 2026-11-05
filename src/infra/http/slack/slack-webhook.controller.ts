import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { GetSlackWebhookUseCase } from '../../../usecases/slack/get-slack-webhook.usecase';
import { RemoveSlackWebhookUseCase } from '../../../usecases/slack/remove-slack-webhook.usecase';
import { SetSlackWebhookUseCase } from '../../../usecases/slack/set-slack-webhook.usecase';
import { TestSlackWebhookUseCase } from '../../../usecases/slack/test-slack-webhook.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { idSchema } from '../projects/projects.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SLACK_TEST_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type SetSlackWebhookBody,
  setSlackWebhookSchema,
  type SlackTestBody,
  slackTestSchema,
  type SlackWebhookBody,
  slackWebhookBody,
  slackWebhookSchema,
} from './slack-webhook.schemas';

const PLAN_FORBIDDEN_DESCRIPTION =
  'The request did not come from the dashboard, the account is suspended (account_suspended), ' +
  'or its plan does not include Slack alerts (plan_required).';

@ApiTags('slack alerts')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project is not one the admin owns (project_not_found), or it has no Slack webhook ' +
    '(slack_webhook_not_found).',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId/slack-webhook')
export class SlackWebhookController {
  constructor(
    private readonly getSlackWebhook: GetSlackWebhookUseCase,
    private readonly setSlackWebhook: SetSlackWebhookUseCase,
    private readonly removeSlackWebhook: RemoveSlackWebhookUseCase,
    private readonly testSlackWebhook: TestSlackWebhookUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'The Slack webhook of a project the admin owns, masked',
    description: 'Answered on any plan, so an account that left Pro can still see and remove it.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: slackWebhookSchema })
  async show(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
  ): Promise<SlackWebhookBody> {
    return slackWebhookBody(
      await this.getSlackWebhook.execute({ adminUserId: adminOf(request).id, projectId }),
    );
  }

  @Put()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @ApiOperation({
    summary: 'Set or replace the Slack webhook the daily alerts are posted to',
    description:
      'Pro only, owner only. Only https://hooks.slack.com/services/… is accepted. The address is ' +
      'stored encrypted (AES-256-GCM) and answered back only masked; a broken mark is cleared.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: slackWebhookSchema })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The address is not a Slack Incoming Webhook (invalid_slack_webhook).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: PLAN_FORBIDDEN_DESCRIPTION,
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The account has no running subscription (subscription_required).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Slack alerts are not configured on this server (slack_unavailable).',
    standardSchema: errorResponseSchema,
  })
  async set(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: setSlackWebhookSchema, pipes: [new SchemaPipe(setSlackWebhookSchema)] })
    body: SetSlackWebhookBody,
  ): Promise<SlackWebhookBody> {
    return slackWebhookBody(
      await this.setSlackWebhook.execute({
        adminUserId: adminOf(request).id,
        projectId,
        url: body.url,
      }),
    );
  }

  @Delete()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove the Slack webhook, at once',
    description: 'Removed on any plan; nothing is posted to it again.',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The webhook is gone.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The request did not come from the dashboard.',
    standardSchema: errorResponseSchema,
  })
  async remove(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
  ): Promise<void> {
    await this.removeSlackWebhook.execute({ adminUserId: adminOf(request).id, projectId });
  }

  @Post('test')
  @SkipThrottle(skipThrottlersExcept(SLACK_TEST_THROTTLER))
  @UseGuards(DashboardOriginGuard, SessionGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post a fixed test message to the Slack webhook',
    description:
      'Pro only, owner only, in the language of the admin. When Slack answers that the webhook ' +
      'no longer exists, it is marked broken.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: slackTestSchema })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many tests from this address (rate_limited).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: PLAN_FORBIDDEN_DESCRIPTION,
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The account has no running subscription (subscription_required).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Slack alerts are not configured on this server (slack_unavailable).',
    standardSchema: errorResponseSchema,
  })
  async test(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
  ): Promise<SlackTestBody> {
    const admin = adminOf(request);
    return {
      outcome: await this.testSlackWebhook.execute({
        adminUserId: admin.id,
        projectId,
        language: admin.emailLanguage,
      }),
    };
  }
}
