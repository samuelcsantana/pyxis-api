import 'reflect-metadata';
import type { PromiseHandler } from '@fastify/aws-lambda';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHttpHandler } from './http-handler';
import { loadParameters, ssmParameterPages } from './load-parameters';

async function buildProxy(): Promise<PromiseHandler> {
  const { NestFactory } = await import('@nestjs/core');
  const { ConsoleLogger } = await import('@nestjs/common');
  const { AppModule } = await import('../app.module');
  const { createFastifyAdapter } = await import('../infra/http/fastify-adapter.options');
  const { configureApp } = await import('../infra/http/configure-app');
  const { createLambdaProxy } = await import('./create-lambda-proxy');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
    logger: new ConsoleLogger({ json: true }),
  });
  configureApp(app);
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return createLambdaProxy(fastify);
}

export const handler = createHttpHandler({
  loadParameters: () => loadParameters(process.env, ssmParameterPages()),
  buildProxy,
  edgeSecret: () => process.env.EDGE_SHARED_SECRET,
});
