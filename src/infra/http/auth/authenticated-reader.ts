import type { FastifyRequest } from 'fastify';
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
  throw new UnauthenticatedError();
}
