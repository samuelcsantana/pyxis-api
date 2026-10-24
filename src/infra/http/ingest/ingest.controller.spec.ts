import { Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  OriginNotAllowedError,
  QuotaExceededError,
  UnknownProjectKeyError,
} from '../../../domain/errors/ingest.errors';
import { PUBLIC_KEY_PREFIX } from '../../../domain/keys/project-keys';
import type {
  IngestBatchCommand,
  IngestBatchResult,
  IngestBatchUseCase,
} from '../../../usecases/ingest/ingest-batch.usecase';
import { IngestController } from './ingest.controller';

const KEY = `${PUBLIC_KEY_PREFIX}${'A'.repeat(32)}`;
const ORIGIN = 'https://shop.example.com';

const RESULT: IngestBatchResult = {
  accepted: 1,
  duplicates: 1,
  rejected: 2,
  projectId: 'project-1',
  allowedOrigin: ORIGIN,
  rejections: [
    { reason: 'invalid_schema', name: null },
    { reason: 'reserved_rules', name: 'page_view' },
  ],
  dropped: [{ eventName: 'plan_selected', field: 'properties.contact', reason: 'email' }],
};

function setup(outcome: () => Promise<IngestBatchResult> = () => Promise.resolve(RESULT)) {
  const commands: IngestBatchCommand[] = [];
  const useCase = {
    execute: (command: IngestBatchCommand) => {
      commands.push(command);
      return outcome();
    },
  } as unknown as IngestBatchUseCase;
  const headers: Record<string, string> = {};
  const reply = {
    header(name: string, value: string) {
      headers[name] = value;
      return reply;
    },
  } as unknown as FastifyReply;
  const request = {
    requestId: 'req-7',
    headers: {
      origin: ORIGIN,
      'user-agent': 'Mozilla/5.0 (Macintosh)',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'cloudfront-viewer-country': 'BR',
      'cloudfront-viewer-country-region': 'SP',
      'cloudfront-viewer-country-region-name': 'S%C3%A3o%20Paulo',
      'cloudfront-viewer-asn': '28573',
      'x-pyxis-arrived-at': '1791295205000',
    },
  } as unknown as FastifyRequest;
  return { controller: new IngestController(useCase), commands, headers, reply, request };
}

describe('IngestController', () => {
  let warnings: jest.SpyInstance;

  beforeEach(() => {
    warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hands the batch and the request headers to the use case', async () => {
    const { controller, commands, reply, request } = setup();

    await controller.ingest(
      { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [{ id: 1 }] },
      request,
      reply,
    );

    expect(commands).toEqual([
      {
        key: KEY,
        sentAt: new Date('2026-10-06T14:00:06.000Z'),
        events: [{ id: 1 }],
        origin: ORIGIN,
        userAgent: 'Mozilla/5.0 (Macintosh)',
        clientHints: { mobile: '?0', platform: '"macOS"' },
        viewerCountry: 'BR',
        viewerRegion: 'SP',
        viewerRegionName: 'S%C3%A3o%20Paulo',
        viewerAsn: '28573',
        arrivedAt: new Date(1_791_295_205_000),
      },
    ]);
  });

  it('answers only the counts and lets the allowed origin read them', async () => {
    const { controller, headers, reply, request } = setup();

    const answer = await controller.ingest(
      { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [] },
      request,
      reply,
    );

    expect(answer).toEqual({ accepted: 1, duplicates: 1, rejected: 2 });
    expect(headers).toEqual({ 'access-control-allow-origin': ORIGIN, vary: 'Origin' });
  });

  it('logs each rejection and each dropped property with the request id, never a value', async () => {
    const { controller, reply, request } = setup();

    await controller.ingest(
      { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [] },
      request,
      reply,
    );

    expect(warnings.mock.calls).toEqual([
      [
        {
          message: 'ingest.event_rejected',
          requestId: 'req-7',
          projectId: 'project-1',
          reason: 'invalid_schema',
          name: null,
        },
      ],
      [
        {
          message: 'ingest.event_rejected',
          requestId: 'req-7',
          projectId: 'project-1',
          reason: 'reserved_rules',
          name: 'page_view',
        },
      ],
      [
        {
          message: 'ingest.property_dropped',
          requestId: 'req-7',
          projectId: 'project-1',
          name: 'plan_selected',
          key: 'properties.contact',
          reason: 'email',
        },
      ],
    ]);
  });

  it.each([
    [
      'an unknown key',
      new UnknownProjectKeyError('https://gone.example.com'),
      { reason: 'unknown_key', origin: 'https://gone.example.com' },
    ],
    [
      'an origin the project does not allow',
      new OriginNotAllowedError('project-1', 'https://www.shop.example.com'),
      {
        reason: 'origin_not_allowed',
        projectId: 'project-1',
        origin: 'https://www.shop.example.com',
      },
    ],
  ])('logs a batch refused for %s with the request id, never the key', async (_, error, logged) => {
    const { controller, reply, request } = setup(() => Promise.reject(error));

    await expect(
      controller.ingest(
        { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [] },
        request,
        reply,
      ),
    ).rejects.toBe(error);

    expect(warnings.mock.calls).toEqual([
      [{ message: 'ingest.batch_refused', requestId: 'req-7', ...logged }],
    ]);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(KEY);
  });

  it('lets any other refusal through without logging it here', async () => {
    const quota = new QuotaExceededError(new Date('2026-11-01T00:00:00.000Z'), ORIGIN);
    const { controller, reply, request } = setup(() => Promise.reject(quota));

    await expect(
      controller.ingest(
        { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [] },
        request,
        reply,
      ),
    ).rejects.toBe(quota);

    expect(warnings).not.toHaveBeenCalled();
  });

  it('answers the preflight with the CORS grant for the asking origin', () => {
    const { controller, headers, reply, request } = setup();

    controller.preflight(request, reply);

    expect(headers).toMatchObject({ 'access-control-allow-origin': ORIGIN, vary: 'Origin' });
  });
});
