import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MCP_PATH, mcpResourceOf, OAUTH_SCOPE } from '../../../domain/oauth/oauth-policy';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../../domain/oauth/remote-mcp-settings';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { type ProtectedResourceMetadataBody, protectedResourceMetadataSchema } from './mcp.schemas';

export const PROTECTED_RESOURCE_METADATA_PATH = '.well-known/oauth-protected-resource';
export const RESOURCE_NAME = 'Pyxis';

export function protectedResourceMetadataUrl(issuer: string): string {
  return `${issuer}/${PROTECTED_RESOURCE_METADATA_PATH}${MCP_PATH}`;
}

export function protectedResourceMetadata(issuer: string): ProtectedResourceMetadataBody {
  return {
    resource: mcpResourceOf(issuer),
    authorization_servers: [issuer],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: RESOURCE_NAME,
  };
}

const DESCRIPTION =
  'Points a client of the MCP endpoint at this API as its authorization server. 404 while the ' +
  'remote MCP is switched off.';

@ApiTags('mcp')
@Controller(PROTECTED_RESOURCE_METADATA_PATH)
export class ProtectedResourceController {
  constructor(@Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings) {}

  @Get(MCP_PATH)
  @ApiOperation({
    summary: 'The protected resource metadata of the MCP endpoint (RFC 9728)',
    description: DESCRIPTION,
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: protectedResourceMetadataSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  forMcp(): ProtectedResourceMetadataBody {
    return protectedResourceMetadata(requireOpen(this.settings).issuer);
  }

  @Get()
  @ApiOperation({
    summary: 'The same metadata at the root address, for clients that look there first',
    description: DESCRIPTION,
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: protectedResourceMetadataSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  atRoot(): ProtectedResourceMetadataBody {
    return this.forMcp();
  }
}
