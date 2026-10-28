import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { PropertyBreakdownReport } from '../../../domain/queries/property-breakdown';
import type { PropertySummaryReport } from '../../../domain/queries/property-summary';
import { GetPropertyBreakdownUseCase } from '../../../usecases/queries/get-property-breakdown.usecase';
import { GetPropertySummaryUseCase } from '../../../usecases/queries/get-property-summary.usecase';
import { ReadAccess } from '../auth/read-access.decorator';
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
import {
  type PropertySummaryQuery,
  propertySummaryQuerySchema,
  type PropertySummaryReportBody,
  propertySummaryReportSchema,
} from './property-summary.schemas';
import { ApiRange } from './queries.controller';
import { ApiReportFilters, filteredRangeOf } from './report-filter-params';
import { ApiAccountSuspended } from '../errors/account-suspended.response';

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

function propertySummaryBody(report: PropertySummaryReport): PropertySummaryReportBody {
  return {
    name: report.name,
    key: report.key,
    by: report.by,
    overall: { ...report.overall },
    groups: report.groups.map((group) => ({ ...group })),
    other_count: report.otherCount,
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
@ApiAccountSuspended()
@Controller('v1/projects/:projectId')
@ReadAccess(ProjectAccessGuard)
export class PropertyBreakdownController {
  constructor(
    private readonly getPropertyBreakdown: GetPropertyBreakdownUseCase,
    private readonly getPropertySummary: GetPropertySummaryUseCase,
  ) {}

  @Get('features/properties')
  @ApiRange()
  @ApiReportFilters()
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
    const report = await this.getPropertyBreakdown.execute(
      projectOf(request),
      filteredRangeOf(query),
      query.name,
    );
    return propertyBreakdownBody(report);
  }

  @Get('features/properties/summary')
  @ApiRange()
  @ApiReportFilters()
  @ApiOperation({
    summary: 'The median of one numeric property of a named event, split by another',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: propertySummaryReportSchema })
  async summary(
    @Req() request: FastifyRequest,
    @Query({
      schema: propertySummaryQuerySchema,
      pipes: [new SchemaPipe(propertySummaryQuerySchema)],
    })
    query: PropertySummaryQuery,
  ): Promise<PropertySummaryReportBody> {
    const report = await this.getPropertySummary.execute(
      projectOf(request),
      filteredRangeOf(query),
      {
        name: query.name,
        key: query.key,
        by: query.by ?? null,
      },
    );
    return propertySummaryBody(report);
  }
}
