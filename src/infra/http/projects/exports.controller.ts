import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { ProjectExport } from '../../../domain/exports/project-export';
import { GetProjectExportUseCase } from '../../../usecases/exports/get-project-export.usecase';
import { RequestProjectExportUseCase } from '../../../usecases/exports/request-project-export.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import {
  ACCESS_TOKENS_THROTTLER,
  AUTH_THROTTLER,
  INGEST_THROTTLER,
  OAUTH_THROTTLER,
  SUBJECTS_THROTTLER,
} from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type ProjectExportBody,
  projectExportSchema,
  type RequestedExportBody,
  requestedExportSchema,
} from './exports.schemas';
import { idSchema } from './projects.schemas';

function isoOrNull(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}

export function projectExportBody(
  projectExport: ProjectExport,
  availableUntil: Date | null,
  downloadUrl: string | null,
): ProjectExportBody {
  return {
    id: projectExport.id,
    status: projectExport.status,
    requested_at: projectExport.requestedAt.toISOString(),
    finished_at: isoOrNull(projectExport.finishedAt),
    event_count: projectExport.eventCount,
    available_until: isoOrNull(availableUntil),
    download_url: downloadUrl,
  };
}

@ApiTags('projects')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'Nothing with this id belongs to an account the admin owns; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@Controller('v1/projects/:projectId/exports')
@SkipThrottle({
  [INGEST_THROTTLER]: true,
  [AUTH_THROTTLER]: true,
  [SUBJECTS_THROTTLER]: true,
  [ACCESS_TOKENS_THROTTLER]: true,
  [OAUTH_THROTTLER]: true,
})
export class ExportsController {
  constructor(
    private readonly requestExport: RequestProjectExportUseCase,
    private readonly getExport: GetProjectExportUseCase,
  ) {}

  @Post()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Export a project's events to a compressed CSV, e-mailed to the owner",
    description:
      'The owner of the account only, whatever the state of the subscription; three a day per ' +
      'project, one at a time.',
  })
  @ApiResponse({ status: HttpStatus.ACCEPTED, standardSchema: requestedExportSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async create(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
  ): Promise<RequestedExportBody> {
    const requested = await this.requestExport.execute({
      adminUserId: adminOf(request).id,
      projectId,
    });
    return {
      export: projectExportBody(requested.projectExport, null, null),
      requested: requested.requested,
    };
  }

  @Get(':exportId')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'An export of a project, with a short download link once it is ready' })
  @ApiParam({ name: 'exportId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: projectExportSchema })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, standardSchema: errorResponseSchema })
  async show(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('exportId', new SchemaPipe(idSchema)) exportId: string,
  ): Promise<ProjectExportBody> {
    const view = await this.getExport.execute({
      adminUserId: adminOf(request).id,
      projectId,
      exportId,
    });
    return projectExportBody(view.projectExport, view.availableUntil, view.downloadUrl);
  }
}
