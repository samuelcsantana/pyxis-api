import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { HealthController } from '../health/health.controller';
import { isSwaggerEnabled, registerSwaggerUi } from './swagger-ui';

describe('isSwaggerEnabled', () => {
  it.each([
    ['production', 'true', true],
    ['development', 'false', false],
    ['development', undefined, true],
    ['test', undefined, true],
    ['production', undefined, false],
  ] as const)('NODE_ENV=%s and SWAGGER_ENABLED=%s → %s', (nodeEnv, flag, expected) => {
    expect(isSwaggerEnabled({ NODE_ENV: nodeEnv, SWAGGER_ENABLED: flag })).toBe(expected);
  });
});

describe('registerSwaggerUi', () => {
  async function appWithSwagger(flag: 'true' | 'false'): Promise<NestFastifyApplication> {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
    registerSwaggerUi(app, { NODE_ENV: 'test', SWAGGER_ENABLED: flag });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  it('serves the document and the UI when enabled', async () => {
    const app = await appWithSwagger('true');

    const json = await app.inject({ method: 'GET', url: '/docs-json' });
    const ui = await app.inject({ method: 'GET', url: '/docs' });

    expect(json.statusCode).toBe(200);
    expect(json.json<{ openapi: string }>().openapi).toBe('3.1.0');
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    await app.close();
  });

  it('serves nothing when disabled', async () => {
    const app = await appWithSwagger('false');

    const response = await app.inject({ method: 'GET', url: '/docs-json' });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
