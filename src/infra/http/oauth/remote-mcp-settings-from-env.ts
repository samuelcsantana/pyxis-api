import type { EnvConfig } from '../../../config/env.schema';
import type { RemoteMcpSettings } from '../../../domain/oauth/remote-mcp-settings';

export type RemoteMcpEnv = Pick<EnvConfig, 'REMOTE_MCP_OPEN' | 'API_ORIGIN' | 'DASHBOARD_ORIGIN'>;

export function remoteMcpSettingsFromEnv(env: RemoteMcpEnv): RemoteMcpSettings {
  if (
    env.REMOTE_MCP_OPEN !== 'true' ||
    env.API_ORIGIN === undefined ||
    env.DASHBOARD_ORIGIN === undefined
  ) {
    return { open: false };
  }
  return { open: true, issuer: env.API_ORIGIN, dashboardOrigin: env.DASHBOARD_ORIGIN };
}
