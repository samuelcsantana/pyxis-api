import { RemoteMcpClosedError } from '../errors/oauth.errors';

export type RemoteMcpSettings =
  | { readonly open: false }
  | { readonly open: true; readonly issuer: string; readonly dashboardOrigin: string };

export type OpenRemoteMcpSettings = Extract<RemoteMcpSettings, { readonly open: true }>;

export const REMOTE_MCP_SETTINGS = Symbol('RemoteMcpSettings');

export function requireOpen(settings: RemoteMcpSettings): OpenRemoteMcpSettings {
  if (!settings.open) {
    throw new RemoteMcpClosedError();
  }
  return settings;
}
