import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { jsonSchemaConverter } from './json-schema-converter';

export const OPENAPI_VERSION = '3.1.0';
export const CONTRACT_VERSION = '1';

const SESSION_COOKIE_SCHEME = {
  type: 'apiKey',
  in: 'cookie',
  name: SESSION_COOKIE_NAME,
} as const;

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setOpenAPIVersion(OPENAPI_VERSION)
    .setTitle('Pyxis API')
    .setDescription(
      'Privacy-first product analytics: event ingestion, dashboard queries and erasure of a ' +
        "user's events. No cookies on tracked visitors, no personal data, no IP address or " +
        'user agent stored.',
    )
    .setVersion(CONTRACT_VERSION)
    .setLicense('MIT', 'https://github.com/samuelcsantana/pyxis-api/blob/main/LICENSE')
    .addCookieAuth(SESSION_COOKIE_NAME, SESSION_COOKIE_SCHEME, SESSION_COOKIE_NAME)
    .build();
  return SwaggerModule.createDocument(app, config, { standardSchemaConverter: jsonSchemaConverter });
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortKeysDeep(child)]),
    );
  }
  return value;
}

export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(sortKeysDeep(document), null, 2)}\n`;
}
