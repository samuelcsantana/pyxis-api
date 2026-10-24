import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';

export function readerOf(request: FastifyRequest): string {
  if (request.session !== undefined) {
    return `session:${request.session.id}`;
  }
  if (request.accessToken !== undefined) {
    return `token:${request.accessToken.id}`;
  }
  if (request.oauthConnection !== undefined) {
    return `connection:${request.oauthConnection.id}`;
  }
  if (request.mcpCaller !== undefined) {
    const { kind, secret } = request.mcpCaller.bearer;
    return `mcp-${kind}:${sha256Hex(secret)}`;
  }
  throw new UnauthenticatedError();
}
