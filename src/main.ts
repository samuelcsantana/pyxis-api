import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.schema';
import { configureApp } from './infra/http/configure-app';
import { createFastifyAdapter } from './infra/http/fastify-adapter.options';
import { registerSwaggerUi } from './infra/http/openapi/swagger-ui';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter());
  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  configureApp(app, { dashboardOrigin: config.get('DASHBOARD_ORIGIN', { infer: true }) });
  registerSwaggerUi(app, {
    NODE_ENV: config.get('NODE_ENV', { infer: true }),
    SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
  });
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
