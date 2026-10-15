import type { RawBodyRequest } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { FixedClock } from '../../../test-utils/fixed-clock';
import type { McpBearer } from './mcp-caller';
import { ACCESS_TOKEN_PROBLEM_TEXTS, CONNECTION_PROBLEM_TEXTS } from './mcp-problem-texts';
import { McpController } from './mcp.controller';

const NOW = new Date('2026-10-15T02:00:00.000Z');
const ISSUER = 'https://api.example.com';
const CONNECTION: McpBearer = { kind: 'connection', secret: `pyxis_oat_${'B'.repeat(43)}` };
const ACCESS_TOKEN: McpBearer = { kind: 'access_token', secret: `pyxis_at_${'A'.repeat(32)}` };
const PROJECT = {
  id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a01',
  name: 'Shop',
  timezone: 'America/Sao_Paulo',
  conversion_event: 'signup_completed',
  first_event_at: '2026-10-01T12:00:00.000Z',
  last_event_at: '2026-10-14T23:00:00.000Z',
};
const MCP_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
  'mcp-protocol-version': '2025-11-25',
};

interface RecordedReply {
  status?: number;
  headers: Record<string, string>;
  body?: unknown;
}

function recordingReply(recorded: RecordedReply): FastifyReply {
  const reply = {
    status(code: number) {
      recorded.status = code;
      return reply;
    },
    header(name: string, value: string) {
      recorded.headers[name] = value;
      return reply;
    },
    send(body: unknown) {
      recorded.body = body;
      return Promise.resolve(reply);
    },
  };
  return reply as unknown as FastifyReply;
}

function mcpRequest(
  method: string,
  bearer: McpBearer | undefined,
  message?: object,
): RawBodyRequest<FastifyRequest> {
  return {
    method,
    url: '/mcp',
    headers: MCP_HEADERS,
    rawBody: message === undefined ? undefined : Buffer.from(JSON.stringify(message)),
    mcpCaller: bearer === undefined ? undefined : { bearer, issuer: ISSUER },
  } as unknown as RawBodyRequest<FastifyRequest>;
}

async function apiWithMe(status = 200): Promise<{ fastify: FastifyInstance; seen: string[] }> {
  const seen: string[] = [];
  const fastify = Fastify();
  fastify.get('/v1/me', (request, reply) => {
    seen.push(String(request.headers.authorization));
    return status === 200
      ? reply.send({ projects: [PROJECT] })
      : reply.status(status).send({ status_code: status, error: 'unauthenticated' });
  });
  await fastify.ready();
  return { fastify, seen };
}

function controllerOver(fastify: FastifyInstance): McpController {
  const adapterHost = {
    httpAdapter: { getInstance: () => fastify },
  } as unknown as HttpAdapterHost;
  return new McpController(new FixedClock(NOW), adapterHost);
}

const LIST_PROJECTS = {
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/call',
  params: { name: 'list_projects', arguments: {} },
};

function toolText(body: unknown): string {
  const answer = JSON.parse(String(body)) as {
    result: { content: { text: string }[]; isError?: boolean };
  };
  return answer.result.content.map(({ text }) => text).join('\n');
}

describe('McpController', () => {
  it('runs a tool by reading the API in process with the caller token', async () => {
    const { fastify, seen } = await apiWithMe();
    const recorded: RecordedReply = { headers: {} };

    await controllerOver(fastify).message(
      mcpRequest('POST', CONNECTION, LIST_PROJECTS),
      recordingReply(recorded),
    );

    expect(recorded.status).toBe(200);
    expect(recorded.headers['content-type']).toContain('application/json');
    expect(seen).toEqual([`Bearer ${CONNECTION.secret}`]);
    const report = JSON.parse(toolText(recorded.body)) as {
      report: { projects: { id: string; today: string }[] };
    };
    expect(report.report.projects).toEqual([
      expect.objectContaining({ id: PROJECT.id, today: '2026-10-14' }),
    ]);
  });

  it.each([
    [CONNECTION, CONNECTION_PROBLEM_TEXTS.refusedToken],
    [ACCESS_TOKEN, ACCESS_TOKEN_PROBLEM_TEXTS.refusedToken],
  ])('explains a refused token in the words of how it was given', async (bearer, problem) => {
    const { fastify } = await apiWithMe(401);
    const recorded: RecordedReply = { headers: {} };

    await controllerOver(fastify).message(
      mcpRequest('POST', bearer, LIST_PROJECTS),
      recordingReply(recorded),
    );

    expect(recorded.status).toBe(200);
    expect(toolText(recorded.body)).toBe(problem);
  });

  it('answers 405 to a GET, which would open a stream this server never keeps', async () => {
    const { fastify, seen } = await apiWithMe();
    const recorded: RecordedReply = { headers: {} };

    await controllerOver(fastify).stream(mcpRequest('GET', CONNECTION), recordingReply(recorded));

    expect(recorded.status).toBe(405);
    expect(recorded.headers.allow).toBe('POST');
    expect(seen).toEqual([]);
  });

  it('answers 405 to a DELETE, as there is no session to end', async () => {
    const { fastify } = await apiWithMe();
    const recorded: RecordedReply = { headers: {} };

    await controllerOver(fastify).end(mcpRequest('DELETE', CONNECTION), recordingReply(recorded));

    expect(recorded.status).toBe(405);
  });

  it('refuses a request the guard did not let in', async () => {
    const { fastify } = await apiWithMe();

    await expect(
      controllerOver(fastify).message(
        mcpRequest('POST', undefined, LIST_PROJECTS),
        recordingReply({ headers: {} }),
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
