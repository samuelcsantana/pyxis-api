import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { singleHeader } from '../request-headers';

export const DASHBOARD_PATHS = ['/v1/auth', '/v1/me'] as const;
export const DASHBOARD_PREFLIGHT_MAX_AGE_SECONDS = 600;

export function isDashboardPath(url: string): boolean {
  const queryStart = url.indexOf('?');
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  return DASHBOARD_PATHS.some((root) => path === root || path.startsWith(`${root}/`));
}

function grantDashboard(reply: FastifyReply, origin: string): void {
  void reply
    .header('access-control-allow-origin', origin)
    .header('access-control-allow-credentials', 'true');
}

async function answerPreflight(reply: FastifyReply, granted: boolean): Promise<void> {
  if (granted) {
    void reply
      .header('access-control-allow-methods', 'GET, POST, OPTIONS')
      .header('access-control-allow-headers', 'Content-Type')
      .header('access-control-max-age', String(DASHBOARD_PREFLIGHT_MAX_AGE_SECONDS));
  }
  await reply.code(204).send();
}

export function registerDashboardCors(
  fastify: FastifyInstance,
  dashboardOrigin: string | undefined,
): void {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDashboardPath(request.url)) {
      return;
    }
    void reply.header('vary', 'Origin');
    const origin = singleHeader(request, 'origin');
    const granted = dashboardOrigin !== undefined && origin === dashboardOrigin;
    if (granted) {
      grantDashboard(reply, dashboardOrigin);
    }
    if (request.method === 'OPTIONS') {
      await answerPreflight(reply, granted);
    }
  });
}
