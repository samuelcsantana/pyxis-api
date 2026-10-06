import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { createFastifyAdapter } from '../fastify-adapter.options';
import { HealthController } from '../health/health.controller';
import {
  buildOpenApiDocument,
  CONTRACT_VERSION,
  OPENAPI_VERSION,
  serializeOpenApiDocument,
} from './openapi-document';

describe('buildOpenApiDocument', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
  });

  afterAll(async () => {
    await app.close();
  });

  it('describes the API as OpenAPI 3.1 with the contract version', () => {
    const document = buildOpenApiDocument(app);

    expect(document.openapi).toBe(OPENAPI_VERSION);
    expect(document.info.title).toBe('Pyxis API');
    expect(document.info.version).toBe(CONTRACT_VERSION);
    expect(document.info.license?.name).toBe('MIT');
  });

  it('declares the dashboard session cookie as a security scheme', () => {
    expect(buildOpenApiDocument(app).components?.securitySchemes).toEqual({
      pyxis_session: { type: 'apiKey', in: 'cookie', name: 'pyxis_session' },
      secret_key: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',
        description: 'A secret project key: pyxis_sk_ followed by 32 letters and digits',
      },
    });
  });

  it('derives response schemas from the Zod schemas of the routes', () => {
    const document = buildOpenApiDocument(app);
    const response = document.paths['/health']?.get?.responses['200'] as {
      content: Record<string, { schema: unknown }>;
    };

    expect(response.content['application/json']?.schema).toEqual({
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
      additionalProperties: false,
    });
  });
});

describe('serializeOpenApiDocument', () => {
  it('sorts keys at every depth, keeps array order and ends with a newline', () => {
    const document = {
      paths: { '/b': {}, '/a': { get: { tags: ['z', 'a'] } } },
      openapi: '3.1.0',
    } as unknown as OpenAPIObject;

    expect(serializeOpenApiDocument(document)).toBe(
      `${JSON.stringify(
        { openapi: '3.1.0', paths: { '/a': { get: { tags: ['z', 'a'] } }, '/b': {} } },
        null,
        2,
      )}\n`,
    );
  });
});
