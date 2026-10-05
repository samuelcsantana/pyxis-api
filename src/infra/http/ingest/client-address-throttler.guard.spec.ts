import { Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { configureApp } from '../configure-app';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { ClientAddressThrottlerGuard } from './client-address-throttler.guard';

const LIMIT = 2;

@Controller('limited')
@UseGuards(ClientAddressThrottlerGuard)
class LimitedController {
  @Post()
  accept(): { ok: true } {
    return { ok: true };
  }
}

describe('ClientAddressThrottlerGuard', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: LIMIT }], setHeaders: false }),
      ],
      controllers: [LimitedController],
      providers: [{ provide: ConfigService, useValue: { get: () => 'x-client-ip' } }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (clientIp: string) =>
    app.inject({ method: 'POST', url: '/limited', headers: { 'x-client-ip': clientIp } });

  it('counts requests per client address read from the trusted header', async () => {
    for (let request = 0; request < LIMIT; request += 1) {
      expect((await send('203.0.113.1')).statusCode).toBe(201);
    }

    const limited = await send('203.0.113.1');
    const otherClient = await send('203.0.113.2');

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ status_code: 429, error: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['x-ratelimit-limit']).toBeUndefined();
    expect(otherClient.statusCode).toBe(201);
  });
});
