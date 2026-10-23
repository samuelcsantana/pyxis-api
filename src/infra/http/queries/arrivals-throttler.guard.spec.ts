import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { AccessToken } from '../../../domain/entities/access-token.entity';
import type { AdminSession } from '../../../domain/entities/admin-session.entity';
import type { OAuthConnection } from '../../../domain/entities/oauth-connection.entity';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { configureApp } from '../configure-app';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { ARRIVALS_THROTTLER } from '../rate-limit/rate-limits';
import { singleHeader } from '../request-headers';
import { ArrivalsThrottlerGuard, readerOf } from './arrivals-throttler.guard';

const LIMIT = 2;
const SINCE = new Date('2026-10-23T12:00:00.000Z');

function session(id: string): AdminSession {
  return { id, adminUserId: 'admin-1', createdAt: SINCE, lastUsedAt: SINCE, device: null };
}

function token(id: string): AccessToken {
  return {
    id,
    adminUserId: 'admin-1',
    name: 'CI',
    createdAt: SINCE,
    lastUsedAt: null,
    expiresAt: SINCE,
  };
}

function connection(id: string): OAuthConnection {
  return { id, adminUserId: 'admin-1', clientId: 'claude', createdAt: SINCE, lastUsedAt: SINCE };
}

@Injectable()
class SessionFromHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    request.session = session(String(singleHeader(request, 'x-session')));
    return true;
  }
}

@Controller('arrivals')
@UseGuards(SessionFromHeaderGuard, ArrivalsThrottlerGuard)
class ArrivalsLikeController {
  @Get()
  arrivals(): { ok: true } {
    return { ok: true };
  }
}

describe('readerOf', () => {
  it('names the session, the access token or the connection that was authenticated', () => {
    expect(readerOf({ session: session('s-1') } as FastifyRequest)).toBe('session:s-1');
    expect(readerOf({ accessToken: token('t-1') } as FastifyRequest)).toBe('token:t-1');
    expect(readerOf({ oauthConnection: connection('c-1') } as FastifyRequest)).toBe(
      'connection:c-1',
    );
  });

  it('refuses a request that nothing authenticated', () => {
    expect(() => readerOf({} as FastifyRequest)).toThrow(UnauthenticatedError);
  });
});

describe('ArrivalsThrottlerGuard', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: ARRIVALS_THROTTLER, ttl: 60_000, limit: LIMIT },
            { name: 'another', ttl: 60_000, limit: 1 },
          ],
          setHeaders: false,
        }),
      ],
      controllers: [ArrivalsLikeController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const ask = (sessionId: string) =>
    app.inject({ method: 'GET', url: '/arrivals', headers: { 'x-session': sessionId } });

  it('limits each session on its own, counting only the arrivals throttler', async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= LIMIT; attempt += 1) {
      statuses.push((await ask('session-a')).statusCode);
    }
    const limited = await ask('session-a');

    expect(statuses).toEqual([200, 200, 429]);
    expect(limited.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect((await ask('session-b')).statusCode).toBe(200);
  });
});
