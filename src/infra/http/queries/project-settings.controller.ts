import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  GetProjectSettingsUseCase,
  type ProjectSettings,
} from '../../../usecases/projects/get-project-settings.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import { type ProjectSettingsBody, projectSettingsSchema } from './project-settings.schemas';

function isoOrNull(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}

export function projectSettingsBody(settings: ProjectSettings): ProjectSettingsBody {
  return {
    id: settings.id,
    name: settings.name,
    timezone: settings.timezone,
    conversion_event: settings.conversionEvent,
    allowed_origins: [...settings.allowedOrigins],
    created_at: settings.createdAt.toISOString(),
    first_event_at: isoOrNull(settings.firstEventAt),
    last_event_at: isoOrNull(settings.lastEventAt),
    event_retention_months: settings.eventRetentionMonths,
    public_keys: settings.publicKeys.map((key) => ({
      id: key.id,
      key: key.publicKey,
      created_at: key.createdAt.toISOString(),
    })),
    secret_keys: settings.secretKeys.map((key) => ({
      id: key.id,
      created_at: key.createdAt.toISOString(),
    })),
  };
}

@ApiTags('dashboard queries')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'The project does not exist or the admin may not read it; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class ProjectSettingsController {
  constructor(private readonly getProjectSettings: GetProjectSettingsUseCase) {}

  @Get('settings')
  @ApiOperation({ summary: 'The settings of the project, its live keys and its activity' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: projectSettingsSchema })
  async settings(@Req() request: FastifyRequest): Promise<ProjectSettingsBody> {
    return projectSettingsBody(await this.getProjectSettings.execute(projectOf(request)));
  }
}
