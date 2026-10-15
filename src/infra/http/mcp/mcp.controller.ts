import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Post,
  type RawBodyRequest,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { MCP_PATH } from '../../../domain/oauth/oauth-policy';
import { CLOCK, type Clock } from '../../../domain/services/clock';
import { AccessTokenThrottlerGuard } from '../auth/access-token-throttler.guard';
import { ACCESS_TOKEN_SECURITY, CONNECTION_TOKEN_SECURITY } from '../auth/read-access.decorator';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import {
  ACCESS_TOKEN_RATE_WINDOW_MS,
  ACCESS_TOKENS_THROTTLER,
  AUTH_THROTTLER,
  INGEST_THROTTLER,
  MCP_MESSAGES_PER_WINDOW,
  OAUTH_THROTTLER,
  SUBJECTS_THROTTLER,
} from '../rate-limit/rate-limits';
import { createInternalFetch } from './internal-fetch';
import { McpAccessGuard } from './mcp-access.guard';
import type { McpCaller } from './mcp-caller';
import { problemTextsFor } from './mcp-problem-texts';
import { McpUnauthorizedFilter } from './mcp-unauthorized';
import { jsonRpcMessageSchema } from './mcp.schemas';
import { sendWebResponse, webRequestOf } from './web-exchange';

const JSON_RPC_BODY = {
  description: 'One JSON-RPC 2.0 message of the Model Context Protocol, as JSON.',
  schema: { type: 'object', required: ['jsonrpc'], properties: { jsonrpc: { const: '2.0' } } },
} as const;

@ApiTags('mcp')
@ApiBearerAuth(CONNECTION_TOKEN_SECURITY)
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller(MCP_PATH)
@SkipThrottle({
  [INGEST_THROTTLER]: true,
  [AUTH_THROTTLER]: true,
  [SUBJECTS_THROTTLER]: true,
  [OAUTH_THROTTLER]: true,
})
@Throttle({
  [ACCESS_TOKENS_THROTTLER]: { limit: MCP_MESSAGES_PER_WINDOW, ttl: ACCESS_TOKEN_RATE_WINDOW_MS },
})
@UseGuards(AccessTokenThrottlerGuard, McpAccessGuard)
@UseFilters(McpUnauthorizedFilter)
export class McpController {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'The remote MCP server: the read-only tools of pyxis-mcp, for Claude and others',
    description:
      'Stateless Streamable HTTP with JSON answers. Each tool reads one dashboard query with the ' +
      "caller's token, inside this API. Without a token, or with a refused one, the answer is " +
      '401 with a WWW-Authenticate header that points at the protected resource metadata. A ' +
      'request with an Origin header is refused (403). 404 while the remote MCP is switched off.',
  })
  @ApiBody(JSON_RPC_BODY)
  @ApiResponse({ status: HttpStatus.OK, standardSchema: jsonRpcMessageSchema })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'A notification, accepted.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: jsonRpcMessageSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  message(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return this.answer(request, reply);
  }

  @Get()
  @ApiExcludeEndpoint()
  stream(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.answer(request, reply);
  }

  @Delete()
  @ApiExcludeEndpoint()
  end(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.answer(request, reply);
  }

  private async answer(
    request: RawBodyRequest<FastifyRequest>,
    reply: FastifyReply,
  ): Promise<void> {
    const caller = callerOf(request);
    const { handleHttpRequest, PyxisApi } = await import('pyxis-mcp');
    const api = new PyxisApi({
      token: caller.bearer.secret,
      apiUrl: caller.issuer,
      fetch: createInternalFetch(this.fastify(), new URL(caller.issuer).origin),
      problemTexts: problemTextsFor(caller.bearer),
    });
    const response = await handleHttpRequest(webRequestOf(request, caller.issuer), api, {
      now: () => this.clock.now(),
    });
    await sendWebResponse(reply, response);
  }

  private fastify(): FastifyInstance {
    return this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
  }
}

function callerOf(request: FastifyRequest): McpCaller {
  if (request.mcpCaller === undefined) {
    throw new UnauthenticatedError();
  }
  return request.mcpCaller;
}
