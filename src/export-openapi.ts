import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { createFastifyAdapter } from './infra/http/fastify-adapter.options';
import {
  buildOpenApiDocument,
  serializeOpenApiDocument,
} from './infra/http/openapi/openapi-document';

const OUTPUT_FILE = path.join('openapi', 'openapi.json');

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
    preview: true,
    logger: false,
  });
  mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, serializeOpenApiDocument(buildOpenApiDocument(app)));
  await app.close();
}

void exportOpenApi();
