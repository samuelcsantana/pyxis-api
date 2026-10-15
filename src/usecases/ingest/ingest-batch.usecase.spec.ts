import type { Project } from '../../domain/entities/project.entity';
import { AccountSuspendedError } from '../../domain/errors/account.errors';
import { ProjectSuspendedError } from '../../domain/errors/project.errors';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  QuotaExceededError,
  UnknownProjectKeyError,
} from '../../domain/errors/ingest.errors';
import { MAX_EVENTS_PER_BATCH } from '../../domain/events/event-limits';
import { PUBLIC_KEY_PREFIX } from '../../domain/keys/project-keys';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountUsageRepository } from '../../test-utils/in-memory-account-usage.repository';
import { InMemoryEventRepository } from '../../test-utils/in-memory-event.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { StubProjectRateLimiter } from '../../test-utils/stub-project-rate-limiter';
import { type IngestBatchCommand, IngestBatchUseCase } from './ingest-batch.usecase';

const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const ORIGIN = 'https://shop.example.com';
const PUBLIC_KEY = `${PUBLIC_KEY_PREFIX}${'A'.repeat(32)}`;
const REVOKED_KEY = `${PUBLIC_KEY_PREFIX}${'R'.repeat(32)}`;
const RECEIVED_AT = new Date('2026-10-06T14:00:10.000Z');
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

const PROJECT: Project = {
  id: 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8',
  name: 'Shop',
  allowedOrigins: [ORIGIN],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

function event(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `9f1c2b3a-1d2e-4f5a-8b6c-${String(index).padStart(12, '0')}`,
    name: 'plan_selected',
    occurred_at: '2026-10-06T14:00:05.000Z',
    session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
    path: '/pricing',
    ...overrides,
  };
}

function setup() {
  const projects = new InMemoryProjectRepository();
  projects.add(
    PROJECT,
    {
      kind: 'secret',
      id: 'k1',
      projectId: PROJECT.id,
      secretHash: 'a'.repeat(64),
      createdAt: RECEIVED_AT,
      revokedAt: null,
    },
    {
      kind: 'public',
      id: 'k2',
      projectId: PROJECT.id,
      publicKey: REVOKED_KEY,
      createdAt: RECEIVED_AT,
      revokedAt: RECEIVED_AT,
    },
    {
      kind: 'public',
      id: 'k3',
      projectId: PROJECT.id,
      publicKey: PUBLIC_KEY,
      createdAt: RECEIVED_AT,
      revokedAt: null,
    },
  );
  const events = new InMemoryEventRepository();
  const rateLimiter = new StubProjectRateLimiter();
  const usage = new InMemoryAccountUsageRepository();
  const useCase = new IngestBatchUseCase(
    projects,
    events,
    rateLimiter,
    new FixedClock(RECEIVED_AT),
    usage,
  );
  const command = (overrides: Partial<IngestBatchCommand> = {}): IngestBatchCommand => ({
    key: PUBLIC_KEY,
    sentAt: RECEIVED_AT,
    events: [event(1)],
    origin: ORIGIN,
    userAgent: SAFARI_IPHONE,
    clientHints: {},
    viewerCountry: 'BR',
    viewerRegion: 'SP',
    viewerRegionName: 'S%C3%A3o%20Paulo',
    ...overrides,
  });
  return { useCase, events, rateLimiter, usage, command };
}

describe('IngestBatchUseCase', () => {
  it('stores the events of an allowed origin and reports the counts', async () => {
    const { useCase, events, command } = setup();

    const result = await useCase.execute(command({ events: [event(1), event(2)] }));

    expect(result).toEqual({
      accepted: 2,
      duplicates: 0,
      rejected: 0,
      projectId: PROJECT.id,
      allowedOrigin: ORIGIN,
      rejections: [],
      dropped: [],
    });
    expect(events.stored).toHaveLength(2);
  });

  it('stamps the project, the device, the location and the reception time on each event', async () => {
    const { useCase, events, command } = setup();

    await useCase.execute(command());

    expect(events.stored[0]).toMatchObject({
      projectId: PROJECT.id,
      receivedAt: RECEIVED_AT,
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      region: 'BR-SP',
      regionName: 'São Paulo',
    });
  });

  it('keeps neither the user agent nor any address on the stored event', async () => {
    const { useCase, events, command } = setup();

    await useCase.execute(command());

    expect(JSON.stringify(events.stored)).not.toContain('Mozilla');
  });

  it('drops a country header that is not a two-letter code', async () => {
    const { useCase, events, command } = setup();

    await useCase.execute(command({ viewerCountry: 'XX1' }));

    expect(events.stored[0]?.country).toBeNull();
  });

  it('keeps no region when the country was dropped', async () => {
    const { useCase, events, command } = setup();

    await useCase.execute(command({ viewerCountry: undefined }));

    expect(events.stored[0]).toMatchObject({ country: null, region: null, regionName: null });
  });

  it('counts a resent event as a duplicate', async () => {
    const { useCase, command } = setup();
    await useCase.execute(command({ events: [event(1), event(2)] }));

    const resent = await useCase.execute(command({ events: [event(1), event(2)] }));

    expect(resent).toMatchObject({ accepted: 0, duplicates: 2, rejected: 0 });
  });

  it('rejects invalid events one by one and keeps the rest of the batch', async () => {
    const { useCase, events, command } = setup();

    const result = await useCase.execute(
      command({
        events: [
          event(1),
          event(2, { name: 'page_view', properties: { plan: 'pro' } }),
          event(3, { user_id: '12345678909' }),
          { name: 'Not A Name' },
          'garbage',
        ],
      }),
    );

    expect(result).toMatchObject({ accepted: 1, duplicates: 0, rejected: 4 });
    expect(result.rejections).toEqual([
      { reason: 'reserved_rules', name: 'page_view' },
      { reason: 'pii_user_id', name: 'plan_selected' },
      { reason: 'invalid_schema', name: null },
      { reason: 'invalid_schema', name: null },
    ]);
    expect(events.stored).toHaveLength(1);
  });

  it('reports the properties it dropped with the event name, never the value', async () => {
    const { useCase, events, command } = setup();

    const result = await useCase.execute(
      command({ events: [event(1, { properties: { contact: 'ana@example.com', plan: 'pro' } })] }),
    );

    expect(result.dropped).toEqual([
      { eventName: 'plan_selected', field: 'properties.contact', reason: 'email' },
    ]);
    expect(events.stored[0]?.properties).toEqual({ plan: 'pro' });
  });

  it('does not call the database when no event is valid', async () => {
    const { useCase, events, command } = setup();

    const result = await useCase.execute(command({ events: ['garbage'] }));

    expect(result).toMatchObject({ accepted: 0, duplicates: 0, rejected: 1 });
    expect(events.insertCalls).toBe(0);
  });

  it('rejects every event of a bot without storing anything', async () => {
    const { useCase, events, command } = setup();

    const result = await useCase.execute(
      command({
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        events: [event(1), event(2)],
      }),
    );

    expect(result).toMatchObject({ accepted: 0, duplicates: 0, rejected: 2 });
    expect(result.rejections).toEqual([
      { reason: 'bot', name: null },
      { reason: 'bot', name: null },
    ]);
    expect(events.insertCalls).toBe(0);
  });

  it(`refuses more than ${String(MAX_EVENTS_PER_BATCH)} events before looking the key up`, async () => {
    const { useCase, rateLimiter, command } = setup();
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, (_, index) => event(index));

    await expect(useCase.execute(command({ events, key: 'unknown' }))).rejects.toBeInstanceOf(
      BatchTooLargeError,
    );
    expect(rateLimiter.calls).toHaveLength(0);
  });

  it.each([
    ['an unknown key', `${PUBLIC_KEY_PREFIX}${'Z'.repeat(32)}`],
    ['a revoked key', REVOKED_KEY],
  ])('refuses %s', async (_, key) => {
    const { useCase, command } = setup();

    await expect(useCase.execute(command({ key }))).rejects.toBeInstanceOf(UnknownProjectKeyError);
  });

  it.each([
    ['a missing origin', undefined],
    ['another site', 'https://evil.example.com'],
    ['the same host on another port', 'https://shop.example.com:8443'],
  ])('refuses %s', async (_, origin) => {
    const { useCase, events, command } = setup();

    await expect(useCase.execute(command({ origin }))).rejects.toBeInstanceOf(
      OriginNotAllowedError,
    );
    expect(events.insertCalls).toBe(0);
  });

  it('refuses a project over its rate limit, with the wait and the allowed origin', async () => {
    const { useCase, rateLimiter, events, command } = setup();
    rateLimiter.decide({ allowed: false, retryAfterSeconds: 17 });

    const failure = useCase.execute(command());

    await expect(failure).rejects.toBeInstanceOf(ProjectRateLimitedError);
    await expect(failure).rejects.toMatchObject({ retryAfterSeconds: 17, allowedOrigin: ORIGIN });
    expect(rateLimiter.calls).toEqual([{ projectId: PROJECT.id, now: RECEIVED_AT }]);
    expect(events.insertCalls).toBe(0);
  });

  it('refuses a project whose account is paused for the month, naming the date it resumes', async () => {
    const { useCase, usage, events, command } = setup();
    const resumesAt = new Date(RECEIVED_AT.getTime() + 60_000);
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    await usage.record(
      '2026-10',
      [{ accountId: ACCOUNT_ID, events: 150_000, ingestionPausedUntil: resumesAt }],
      RECEIVED_AT,
    );

    const failure = useCase.execute(command());

    await expect(failure).rejects.toBeInstanceOf(QuotaExceededError);
    await expect(failure).rejects.toMatchObject({
      pausedUntil: resumesAt,
      allowedOrigin: ORIGIN,
      code: 'quota_exceeded',
    });
    expect(events.insertCalls).toBe(0);
  });

  it('refuses a project whose account is suspended, keeping the origin for the CORS answer', async () => {
    const { useCase, usage, events, command } = setup();
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    usage.markSuspended(ACCOUNT_ID);

    const failure = useCase.execute(command());

    await expect(failure).rejects.toBeInstanceOf(AccountSuspendedError);
    await expect(failure).rejects.toMatchObject({
      allowedOrigin: ORIGIN,
      code: 'account_suspended',
    });
    expect(events.insertCalls).toBe(0);
  });

  it('refuses a project whose reception is suspended, keeping the origin for the CORS answer', async () => {
    const { useCase, usage, events, command } = setup();
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    usage.suspendIngestionOf(PROJECT.id);

    const failure = useCase.execute(command());

    await expect(failure).rejects.toBeInstanceOf(ProjectSuspendedError);
    await expect(failure).rejects.toMatchObject({
      allowedOrigin: ORIGIN,
      code: 'project_suspended',
    });
    expect(events.insertCalls).toBe(0);
  });

  it('names the account suspension before the project one when both apply', async () => {
    const { useCase, usage, command } = setup();
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    usage.markSuspended(ACCOUNT_ID);
    usage.suspendIngestionOf(PROJECT.id);

    await expect(useCase.execute(command())).rejects.toBeInstanceOf(AccountSuspendedError);
  });

  it('names the suspension before the monthly pause when both apply', async () => {
    const { useCase, usage, command } = setup();
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    usage.markSuspended(ACCOUNT_ID);
    await usage.record(
      '2026-10',
      [
        {
          accountId: ACCOUNT_ID,
          events: 150_000,
          ingestionPausedUntil: new Date(RECEIVED_AT.getTime() + 60_000),
        },
      ],
      RECEIVED_AT,
    );

    await expect(useCase.execute(command())).rejects.toBeInstanceOf(AccountSuspendedError);
  });

  it('takes events again once the pause has passed', async () => {
    const { useCase, usage, events, command } = setup();
    usage.placeProject(PROJECT.id, ACCOUNT_ID);
    await usage.record(
      '2026-10',
      [{ accountId: ACCOUNT_ID, events: 150_000, ingestionPausedUntil: RECEIVED_AT }],
      RECEIVED_AT,
    );

    await expect(useCase.execute(command())).resolves.toMatchObject({ accepted: 1 });
    expect(events.insertCalls).toBe(1);
  });
});
