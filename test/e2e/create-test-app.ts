import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/infra/http/configure-app';
import { createFastifyAdapter } from '../../src/infra/http/fastify-adapter.options';

export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<NestFastifyApplication> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
  configureApp(app, { dashboardOrigin: process.env.DASHBOARD_ORIGIN });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
