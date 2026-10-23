import { Controller, Get, UseGuards } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { configureApp } from '../configure-app';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { ACCESS_TOKENS_THROTTLER } from '../rate-limit/rate-limits';
import { AccessTokenThrottlerGuard } from './access-token-throttler.guard';

const LIMIT = 2;
const TOKEN_A = `Bearer pyxis_at_${'A'.repeat(32)}`;
const TOKEN_B = `Bearer pyxis_at_${'B'.repeat(32)}`;
const TOKEN_C = `Bearer pyxis_at_${'C'.repeat(32)}`;
const ANOTHER_THROTTLER = 'another';

@Controller('read')
@UseGuards(AccessTokenThrottlerGuard)
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

  it('limits each presented token on its own and answers 429 with Retry-After', async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= LIMIT; attempt += 1) {
      statuses.push((await read({ authorization: TOKEN_A })).statusCode);
    }
    const limited = await read({ authorization: TOKEN_A });

    expect(statuses).toEqual([200, 200, 429]);
    expect(limited.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect((await read({ authorization: TOKEN_B })).statusCode).toBe(200);
  });

  it('never limits a request without an authorization header, which uses the session', async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= LIMIT + 1; attempt += 1) {
      statuses.push((await read({})).statusCode);
    }

    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it('counts only the access token throttler, whatever else the route registers', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      statuses.push((await read({ authorization: TOKEN_C })).statusCode);
    }

    expect(statuses).toEqual([200, 200]);
  });
});
