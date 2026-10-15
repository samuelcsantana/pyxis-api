import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { OAuthConnection } from '../../../domain/entities/oauth-connection.entity';
import { allowedClient, hostnameOf } from '../../../domain/oauth/oauth-clients';
import { mcpResourceOf } from '../../../domain/oauth/oauth-policy';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
} from '../../../domain/oauth/remote-mcp-settings';
import { ListConnectionsUseCase } from '../../../usecases/oauth/list-connections.usecase';
import { RevokeConnectionUseCase } from '../../../usecases/oauth/revoke-connection.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import { connectionIdSchema, type ConnectionsBody, connectionsSchema } from './oauth.schemas';

const CONNECTION_ID = 'connectionId';

function listedConnection(connection: OAuthConnection): ConnectionsBody['connections'][number] {
  return {
    id: connection.id,
    client: {
      name: allowedClient(connection.clientId)?.name ?? hostnameOf(connection.clientId),
      host: hostnameOf(connection.clientId),
    },
    created_at: connection.createdAt.toISOString(),
    last_used_at: connection.lastUsedAt.toISOString(),
  };
}

@ApiTags('dashboard sign-in')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('v1/me/connections')
export class ConnectionsController {
  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    private readonly listConnections: ListConnectionsUseCase,
    private readonly revokeConnection: RevokeConnectionUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'The applications connected by the signed-in admin, and whether connecting is open',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: connectionsSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  async list(@Req() request: FastifyRequest): Promise<ConnectionsBody> {
    const connections = await this.listConnections.execute(adminOf(request));
    return {
      connector: this.settings.open
        ? { open: true, url: mcpResourceOf(this.settings.issuer) }
        : { open: false, url: null },
      connections: connections.map(listedConnection),
    };
  }

  @Delete(`:${CONNECTION_ID}`)
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect one application of the signed-in admin, at once' })
  @ApiParam({ name: CONNECTION_ID, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Its tokens no longer work.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No live connection of this admin has this id; the answer never says more.',
    standardSchema: errorResponseSchema,
  })
  async revoke(
    @Req() request: FastifyRequest,
    @Param(CONNECTION_ID, new SchemaPipe(connectionIdSchema)) connectionId: string,
  ): Promise<void> {
    await this.revokeConnection.execute(adminOf(request), connectionId);
  }
}
