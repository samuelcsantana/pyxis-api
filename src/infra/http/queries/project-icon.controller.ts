import { Controller, Get, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SITE_ICON_TYPES } from '../../../domain/projects/site-icon';
import { GetProjectIconUseCase } from '../../../usecases/projects/get-project-icon.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from './project-access.guard';

export const PROJECT_ICON_CACHE_CONTROL = 'private, max-age=86400';

@ApiTags('dashboard queries')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project does not exist, the admin may not read it, or its site shows no icon (yet).',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class ProjectIconController {
  constructor(private readonly getProjectIcon: GetProjectIconUseCase) {}

  @Get('icon')
  @ApiOperation({
    summary: "The icon of the project's site",
    description:
      'Taken from the first allowed origin once a day: the touch icon or the largest icon the ' +
      'home page declares, else /favicon.ico; raster images only, up to 100 KB. Cache it by ' +
      'adding icon_version from GET /v1/me to the URL.',
  })
  @ApiProduces(...SITE_ICON_TYPES)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The image, as the site serves it.',
    schema: { type: 'string', format: 'binary' },
  })
  async icon(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const icon = await this.getProjectIcon.execute(projectOf(request).id);
    reply.header('content-type', icon.contentType);
    reply.header('cache-control', PROJECT_ICON_CACHE_CONTROL);
    return Buffer.from(icon.bytes);
  }
}
