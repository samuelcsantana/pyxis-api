import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { OAUTH_SCOPE } from '../../../domain/oauth/oauth-policy';
import { ApproveAuthorizationRequestUseCase } from '../../../usecases/oauth/approve-authorization-request.usecase';
import { DenyAuthorizationRequestUseCase } from '../../../usecases/oauth/deny-authorization-request.usecase';
import { DescribeAuthorizationRequestUseCase } from '../../../usecases/oauth/describe-authorization-request.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  type AuthorizationDecisionBody,
  authorizationDecisionSchema,
  type AuthorizationRequestBody,
  authorizationRequestIdSchema,
  authorizationRequestSchema,
} from './oauth.schemas';

const REQUEST_ID = 'requestId';

@ApiTags('oauth')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('v1/oauth/requests')
export class AuthorizationRequestsController {
  constructor(
    private readonly describeRequest: DescribeAuthorizationRequestUseCase,
    private readonly approveRequest: ApproveAuthorizationRequestUseCase,
    private readonly denyRequest: DenyAuthorizationRequestUseCase,
  ) {}

  @Get(`:${REQUEST_ID}`)
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'A connection request waiting for the signed-in admin, for the consent page',
  })
  @ApiParam({ name: REQUEST_ID, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: authorizationRequestSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Unknown, expired or already answered; also while the remote MCP is off.',
    standardSchema: errorResponseSchema,
  })
  async describe(
    @Req() request: FastifyRequest,
    @Param(REQUEST_ID, new SchemaPipe(authorizationRequestIdSchema)) requestId: string,
  ): Promise<AuthorizationRequestBody> {
    const described = await this.describeRequest.execute(adminOf(request), requestId);
    return {
      id: described.id,
      client: { name: described.client.name, host: described.clientHost },
      redirect: { host: described.redirectHost, loopback: described.loopback },
      scope: OAUTH_SCOPE,
      expires_at: described.expiresAt.toISOString(),
      projects: described.projects.map((project) => ({ id: project.id, name: project.name })),
      connection_limit_reached: described.connectionLimitReached,
    };
  }

  @Post(`:${REQUEST_ID}/approve`)
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Allow the application: answers where to send the browser, with a one-time code',
  })
  @ApiParam({ name: REQUEST_ID, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: authorizationDecisionSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The admin already keeps ten connected applications.',
    standardSchema: errorResponseSchema,
  })
  async approve(
    @Req() request: FastifyRequest,
    @Param(REQUEST_ID, new SchemaPipe(authorizationRequestIdSchema)) requestId: string,
  ): Promise<AuthorizationDecisionBody> {
    return { redirect_to: await this.approveRequest.execute(adminOf(request), requestId) };
  }

  @Post(`:${REQUEST_ID}/deny`)
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline the application: answers where to send the browser' })
  @ApiParam({ name: REQUEST_ID, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: authorizationDecisionSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  async deny(
    @Req() request: FastifyRequest,
    @Param(REQUEST_ID, new SchemaPipe(authorizationRequestIdSchema)) requestId: string,
  ): Promise<AuthorizationDecisionBody> {
    return { redirect_to: await this.denyRequest.execute(adminOf(request), requestId) };
  }
}
