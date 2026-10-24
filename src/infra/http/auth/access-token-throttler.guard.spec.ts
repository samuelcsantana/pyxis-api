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
import { configureApp } from '../configure-app';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { ACCESS_TOKENS_THROTTLER } from '../rate-limit/rate-limits';
import { singleHeader } from '../request-headers';
import { AccessTokenThrottlerGuard } from './access-token-throttler.guard';

const LIMIT = 2;
const TOKEN_A = `Bearer pyxis_at_${'A'.repeat(32)}`;
const TOKEN_B = `Bearer pyxis_at_${'B'.repeat(32)}`;
const TOKEN_C = `Bearer pyxis_at_${'C'.repeat(32)}`;
const ANOTHER_THROTTLER = 'another';
const READER_HEADER = 'x-test-reader';
const AUTHENTICATED_AT = new Date('2026-10-24T12:00:00.000Z');

@Injectable()
class AuthenticateFromHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const [kind, id = ''] = (singleHeader(request, READER_HEADER) ?? '').split(':');
    switch (kind) {
      case 'token':
        request.accessToken = {
          id,
          adminUserId: 'admin',
          name: 'Claude Code',
          createdAt: AUTHENTICATED_AT,
          lastUsedAt: null,
          expiresAt: AUTHENTICATED_AT,
        };
        return true;
      case 'connection':
        request.oauthConnection = {
          id,
          adminUserId: 'admin',
          clientId: 'claude',
          createdAt: AUTHENTICATED_AT,
          lastUsedAt: AUTHENTICATED_AT,
        };
        return true;
      case 'mcp':
        request.mcpCaller = {
          bearer: { kind: 'connection', secret: id },
          issuer: 'https://api.example.com',
        };
        return true;
      default:
        return true;
    }
  }
}

@Controller('read')
@UseGuards(AuthenticateFromHeaderGuard, AccessTokenThrottlerGuard)
class ReadController {
  @Get()
  read(): { ok: true } {
    return { ok: true };
  }
}

describe('AccessTokenThrottlerGuard', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: ACCESS_TOKENS_THROTTLER, ttl: 60_000, limit: LIMIT },
            { name: ANOTHER_THROTTLER, ttl: 60_000, limit: 1 },
          ],
          setHeaders: false,
        }),
      ],
      controllers: [ReadController],
      providers: [AuthenticateFromHeaderGuard],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const read = (headers: Record<string, string>) =>
    app.inject({ method: 'GET', url: '/read', headers });

  it('limits each authenticated reader on its own and answers 429 with Retry-After', async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= LIMIT; attempt += 1) {
      statuses.push(
        (await read({ authorization: TOKEN_A, [READER_HEADER]: 'token:a' })).statusCode,
      );
    }
    const limited = await read({ authorization: TOKEN_A, [READER_HEADER]: 'token:a' });

    expect(statuses).toEqual([200, 200, 429]);
    expect(limited.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect((await read({ authorization: TOKEN_A, [READER_HEADER]: 'token:b' })).statusCode).toBe(
      200,
    );
  });

  it.each([
    ['access token', 'token:same'],
    ['connection', 'connection:same'],
    ['MCP caller', 'mcp:pyxis_oat_same'],
  ])(
    'counts an authenticated %s by what was authenticated, not by the header that carried it',
    async (_label, reader) => {
      const statuses = [];
      for (const authorization of [TOKEN_A, TOKEN_B, TOKEN_C]) {
        statuses.push((await read({ authorization, [READER_HEADER]: reader })).statusCode);
      }

      expect(statuses).toEqual([200, 200, 429]);
    },
  );

  it('never limits a request without an authorization header, which uses the session', async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= LIMIT + 1; attempt += 1) {
      statuses.push((await read({})).statusCode);
    }

    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it('answers 401 when a header reaches it that nothing authenticated', async () => {
    const refused = await read({ authorization: TOKEN_A });

    expect(refused.statusCode).toBe(401);
  });

  it('counts only the access token throttler, whatever else the route registers', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      statuses.push(
        (await read({ authorization: TOKEN_C, [READER_HEADER]: 'token:c' })).statusCode,
      );
    }

    expect(statuses).toEqual([200, 200]);
  });
});
