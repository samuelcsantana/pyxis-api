import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import type { AdminSession } from '../../../domain/entities/admin-session.entity';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { DashboardOriginRequiredError } from '../errors/http-errors';
import { singleHeader } from '../request-headers';
import { readSessionToken } from './session-cookie';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminUser;
    session?: AdminSession;
  }
}

@Injectable()
export class DashboardOriginGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const dashboardOrigin = this.config.get('DASHBOARD_ORIGIN', { infer: true });
    if (dashboardOrigin === undefined || singleHeader(request, 'origin') !== dashboardOrigin) {
      throw new DashboardOriginRequiredError();
    }
    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authenticateSession: AuthenticateSessionUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authenticated = await this.authenticateSession.execute(
      readSessionToken(singleHeader(request, 'cookie')),
    );
    request.admin = authenticated.admin;
    request.session = authenticated.session;
    return true;
  }
}

export function adminOf(request: FastifyRequest): AdminUser {
  if (request.admin === undefined) {
    throw new Error('SessionGuard must run before a route reads the admin.');
  }
  return request.admin;
}

export function sessionOf(request: FastifyRequest): AdminSession {
  if (request.session === undefined) {
    throw new Error('SessionGuard must run before a route reads the session.');
  }
  return request.session;
}
