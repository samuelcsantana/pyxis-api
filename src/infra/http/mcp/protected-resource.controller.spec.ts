import { RemoteMcpClosedError } from '../../../domain/errors/oauth.errors';
import type { RemoteMcpSettings } from '../../../domain/oauth/remote-mcp-settings';
import { protectedResourceMetadataSchema } from './mcp.schemas';
import {
  ProtectedResourceController,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
} from './protected-resource.controller';

const ISSUER = 'https://api.example.com';
const OPEN: RemoteMcpSettings = {
  open: true,
  issuer: ISSUER,
  dashboardOrigin: 'https://app.example.com',
};

describe('ProtectedResourceController', () => {
  it('names the MCP endpoint as the resource and this API as its only authorization server', () => {
    const metadata = new ProtectedResourceController(OPEN).forMcp();

    expect(metadata).toEqual({
      resource: 'https://api.example.com/mcp',
      authorization_servers: [ISSUER],
      scopes_supported: ['read'],
      bearer_methods_supported: ['header'],
      resource_name: 'Pyxis',
    });
    expect(protectedResourceMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it('answers the same document at the root address', () => {
    const controller = new ProtectedResourceController(OPEN);

    expect(controller.atRoot()).toEqual(protectedResourceMetadata(ISSUER));
  });

  it('answers 404 at both addresses while the remote MCP is switched off', () => {
    const controller = new ProtectedResourceController({ open: false });

    expect(() => controller.forMcp()).toThrow(RemoteMcpClosedError);
    expect(() => controller.atRoot()).toThrow(RemoteMcpClosedError);
  });

  it('places the metadata of the MCP endpoint under the well-known prefix', () => {
    expect(protectedResourceMetadataUrl(ISSUER)).toBe(
      'https://api.example.com/.well-known/oauth-protected-resource/mcp',
    );
  });
});
