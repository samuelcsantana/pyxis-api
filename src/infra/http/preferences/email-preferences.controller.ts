import { Body, Controller, Get, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { EmailPreferences } from '../../../domain/entities/email-preferences.entity';
import { GetEmailPreferencesUseCase } from '../../../usecases/preferences/get-email-preferences.usecase';
import { SetEmailPreferencesUseCase } from '../../../usecases/preferences/set-email-preferences.usecase';
import { adminOf, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from '../queries/project-access.guard';
import { SchemaPipe } from '../schema-pipe';
import { type EmailPreferencesBody, emailPreferencesSchema } from './email-preferences.schemas';

function emailPreferencesBody(preferences: EmailPreferences): EmailPreferencesBody {
  return { weekly_digest: preferences.weeklyDigest };
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
@UseGuards(SessionGuard, ProjectAccessGuard)
export class EmailPreferencesController {
  constructor(
    private readonly getEmailPreferences: GetEmailPreferencesUseCase,
    private readonly setEmailPreferences: SetEmailPreferencesUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The e-mails the signed-in admin receives about the project' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: emailPreferencesSchema })
  async preferences(@Req() request: FastifyRequest): Promise<EmailPreferencesBody> {
    return emailPreferencesBody(
      await this.getEmailPreferences.execute(adminOf(request), projectOf(request)),
    );
  }

  @Put()
  @ApiOperation({
    summary: 'Choose the e-mails the signed-in admin receives about the project',
    description: 'Changes only the signed-in admin, for this project only.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: emailPreferencesSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  async choose(
    @Req() request: FastifyRequest,
    @Body({ schema: emailPreferencesSchema, pipes: [new SchemaPipe(emailPreferencesSchema)] })
    body: EmailPreferencesBody,
  ): Promise<EmailPreferencesBody> {
    return emailPreferencesBody(
      await this.setEmailPreferences.execute(adminOf(request), projectOf(request), {
        weeklyDigest: body.weekly_digest,
      }),
    );
  }
}
