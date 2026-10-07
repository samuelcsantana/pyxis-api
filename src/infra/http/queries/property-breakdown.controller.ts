import { Controller, Get, HttpStatus, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { PropertyBreakdownReport } from '../../../domain/queries/property-breakdown';
import { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import { SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { ProjectAccessGuard, projectOf } from './project-access.guard';
import {
  type PropertyBreakdownQuery,
  propertyBreakdownQuerySchema,
  type PropertyBreakdownReportBody,
  propertyBreakdownReportSchema,
} from './property-breakdown.schemas';
import { ApiRange } from './queries.controller';

function propertyBreakdownBody(report: PropertyBreakdownReport): PropertyBreakdownReportBody {
  return {
    name: report.name,
    events: report.events,
    keys: report.keys.map((key) => ({
      key: key.key,
      events: key.events,
      values: key.values.map((value) => ({ ...value })),
      other_count: key.otherCount,
    })),
  };
}

@ApiTags('dashboard queries')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'The project does not exist or the admin may not read it; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class PropertyBreakdownController {
  constructor(private readonly getPropertyBreakdown: GetPropertyBreakdownUseCase) {}

  @Get('features/properties')
  @ApiRange()
  @ApiOperation({ summary: 'How the property values of one named event break down' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: propertyBreakdownReportSchema })
  async properties(
    @Req() request: FastifyRequest,
    @Query({
      schema: propertyBreakdownQuerySchema,
      pipes: [new SchemaPipe(propertyBreakdownQuerySchema)],
    })
    query: PropertyBreakdownQuery,
  ): Promise<PropertyBreakdownReportBody> {
    const range = { from: query.from, to: query.to };
    const report = await this.getPropertyBreakdown.execute(projectOf(request), range, query.name);
    return propertyBreakdownBody(report);
  }
}
