import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { EnvConfig } from '../../../config/env.schema';
import { buildOpenApiDocument } from './openapi-document';

export const SWAGGER_UI_PATH = 'docs';

export function isSwaggerEnabled(env: Pick<EnvConfig, 'NODE_ENV' | 'SWAGGER_ENABLED'>): boolean {
  if (env.SWAGGER_ENABLED !== undefined) {
    return env.SWAGGER_ENABLED === 'true';
  }
  return env.NODE_ENV !== 'production';
}

export function registerSwaggerUi(
  app: INestApplication,
  env: Pick<EnvConfig, 'NODE_ENV' | 'SWAGGER_ENABLED'>,
): void {
  if (!isSwaggerEnabled(env)) {
    return;
  }
  SwaggerModule.setup(SWAGGER_UI_PATH, app, buildOpenApiDocument(app));
}
