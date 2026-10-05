import { Controller, Get } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { configureApp } from './configure-app';
import { createFastifyAdapter } from './fastify-adapter.options';

@Controller('probe')
class ProbeController {
  @Get()
  probe(): { ok: true } {
    return { ok: true };
  }
}

describe('configureApp', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers the security headers and the request id on the app', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
