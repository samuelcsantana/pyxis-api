import { Body, Controller, Get, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type {
  EmailPreferenceChanges,
  EmailPreferences,
} from '../../../domain/entities/email-preferences.entity';
import { GetEmailPreferencesUseCase } from '../../../usecases/preferences/get-email-preferences.usecase';
import { SetEmailPreferencesUseCase } from '../../../usecases/preferences/set-email-preferences.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from '../queries/project-access.guard';
import { SchemaPipe } from '../schema-pipe';
import {
  type EmailPreferenceChangesBody,
  emailPreferenceChangesSchema,
  type EmailPreferencesBody,
  emailPreferencesSchema,
} from './email-preferences.schemas';
import {
  ApiAccountSuspended,
  SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION,
} from '../errors/account-suspended.response';

function emailPreferencesBody(preferences: EmailPreferences): EmailPreferencesBody {
  return {
    weekly_digest: preferences.weeklyDigest,
    no_events_alert: preferences.noEventsAlert,
    failed_writes_alert: preferences.failedWritesAlert,
    conversion_drop_alert: preferences.conversionDropAlert,
  };
}

function preferenceChangesOf(body: EmailPreferenceChangesBody): EmailPreferenceChanges {
  return {
    ...(body.weekly_digest === undefined ? {} : { weeklyDigest: body.weekly_digest }),
    ...(body.no_events_alert === undefined ? {} : { noEventsAlert: body.no_events_alert }),
    ...(body.failed_writes_alert === undefined
      ? {}
      : { failedWritesAlert: body.failed_writes_alert }),
    ...(body.conversion_drop_alert === undefined
      ? {}
      : { conversionDropAlert: body.conversion_drop_alert }),
  };
}

@ApiTags('dashboard preferences')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'The project does not exist or the admin may not read it; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId/email-preferences')
export class EmailPreferencesController {
  constructor(
    private readonly getEmailPreferences: GetEmailPreferencesUseCase,
    private readonly setEmailPreferences: SetEmailPreferencesUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard, ProjectAccessGuard)
  @ApiOperation({ summary: 'The e-mails the signed-in admin receives about the project' })
  @ApiAccountSuspended()
  @ApiResponse({ status: HttpStatus.OK, standardSchema: emailPreferencesSchema })
  async preferences(@Req() request: FastifyRequest): Promise<EmailPreferencesBody> {
    return emailPreferencesBody(
      await this.getEmailPreferences.execute(adminOf(request), projectOf(request)),
    );
  }

  @Put()
  @UseGuards(DashboardOriginGuard, SessionGuard, ProjectAccessGuard)
  @ApiOperation({
    summary: 'Choose the e-mails the signed-in admin receives about the project',
    description:
      'Changes only the signed-in admin, for this project only; the preferences left out keep ' +
      'their value.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: emailPreferencesSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
  async choose(
    @Req() request: FastifyRequest,
    @Body({
      schema: emailPreferenceChangesSchema,
      pipes: [new SchemaPipe(emailPreferenceChangesSchema)],
    })
    body: EmailPreferenceChangesBody,
  ): Promise<EmailPreferencesBody> {
    return emailPreferencesBody(
      await this.setEmailPreferences.execute(
        adminOf(request),
        projectOf(request),
        preferenceChangesOf(body),
      ),
    );
  }
}
