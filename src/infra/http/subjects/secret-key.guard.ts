import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { LiveSecretKey } from '../../../domain/repositories/project-key.repository';
import { AuthenticateSecretKeyUseCase } from '../../../usecases/subjects/authenticate-secret-key.usecase';
import { singleHeader } from '../request-headers';

declare module 'fastify' {
  interface FastifyRequest {
    secretKey?: LiveSecretKey;
  }
}

@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateSecretKeyUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    request.secretKey = await this.authenticate.execute(singleHeader(request, 'authorization'));
    return true;
  }
}

export function secretKeyOf(request: FastifyRequest): LiveSecretKey {
  if (request.secretKey === undefined) {
    throw new Error('SecretKeyGuard must run before a route reads the secret key.');
  }
  return request.secretKey;
}
