import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  MCP_UNAUTHORIZED_MESSAGES,
  mcpChallenge,
  McpUnauthorizedError,
  McpUnauthorizedFilter,
} from './mcp-unauthorized';

const ISSUER = 'https://api.example.com';
const METADATA = 'https://api.example.com/.well-known/oauth-protected-resource/mcp';

interface RecordedReply {
  status?: number;
  headers: Record<string, string>;
  body?: unknown;
}

function recordingHost(recorded: RecordedReply): ArgumentsHost {
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
      return reply;
    },
  } as unknown as FastifyReply;
  return { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
}

describe('mcpChallenge', () => {
  it('points a caller without a token at the protected resource metadata', () => {
    expect(mcpChallenge(ISSUER, false)).toBe(
      `Bearer resource_metadata="${METADATA}", scope="read"`,
    );
  });

  it('tells a caller whose token was refused that the token is invalid', () => {
    expect(mcpChallenge(ISSUER, true)).toBe(
      'Bearer error="invalid_token", error_description="The token is unknown, expired or ' +
        `revoked.", resource_metadata="${METADATA}", scope="read"`,
    );
  });
});

describe('McpUnauthorizedError', () => {
  it.each([
    [false, MCP_UNAUTHORIZED_MESSAGES.missing],
    [true, MCP_UNAUTHORIZED_MESSAGES.refused],
  ])('says what to do when a token was presented: %s', (presented, message) => {
    const error = new McpUnauthorizedError(ISSUER, presented);

    expect(error.message).toBe(message);
    expect(error.name).toBe('McpUnauthorizedError');
    expect(error.challenge).toBe(mcpChallenge(ISSUER, presented));
  });
});

describe('McpUnauthorizedFilter', () => {
  it('answers 401 with the challenge in WWW-Authenticate', () => {
    const recorded: RecordedReply = { headers: {} };

    new McpUnauthorizedFilter().catch(
      new McpUnauthorizedError(ISSUER, true),
      recordingHost(recorded),
    );

    expect(recorded).toEqual({
      status: 401,
      headers: { 'www-authenticate': mcpChallenge(ISSUER, true) },
      body: {
        status_code: 401,
        error: 'unauthenticated',
        message: MCP_UNAUTHORIZED_MESSAGES.refused,
      },
    });
  });
});
