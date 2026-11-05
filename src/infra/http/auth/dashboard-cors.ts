import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { singleHeader } from '../request-headers';

export const DASHBOARD_PATHS = ['/v1/auth', '/v1/me', '/v1/projects', '/v1/shared'] as const;
export const DASHBOARD_PREFLIGHT_MAX_AGE_SECONDS = 600;
export const SHARED_PATH = '/v1/shared';

const DASHBOARD_HEADERS = 'Content-Type';
const SHARED_HEADERS = 'Content-Type, Authorization';

function pathOf(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

function isUnder(root: string, path: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function isDashboardPath(url: string): boolean {
  const path = pathOf(url);
  return DASHBOARD_PATHS.some((root) => isUnder(root, path));
}

export function allowedHeadersFor(url: string): string {
  return isUnder(SHARED_PATH, pathOf(url)) ? SHARED_HEADERS : DASHBOARD_HEADERS;
}

function grantDashboard(reply: FastifyReply, origin: string): void {
  void reply.header('access-control-allow-origin', origin);
}

async function answerPreflight(
  reply: FastifyReply,
  granted: boolean,
  allowedHeaders: string,
): Promise<void> {
  if (granted) {
    void reply
      .header('access-control-allow-methods', 'GET, POST, OPTIONS')
      .header('access-control-allow-headers', allowedHeaders)
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
      await answerPreflight(reply, granted, allowedHeadersFor(request.url));
    }
  });
}
