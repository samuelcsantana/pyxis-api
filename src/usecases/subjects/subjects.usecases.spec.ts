import { Logger } from '@nestjs/common';
import type { ProjectKey } from '../../domain/entities/project-key.entity';
import type { Project } from '../../domain/entities/project.entity';
import { UnknownProjectKeyError } from '../../domain/errors/ingest.errors';
import { UnknownCursorError } from '../../domain/errors/subject.errors';
import { hashSecretKey, SECRET_KEY_PREFIX } from '../../domain/keys/project-keys';
import type { ProjectKeyRepository } from '../../domain/repositories/project-key.repository';
import { EXPORT_PAGE_SIZE } from '../../domain/subjects/subject-events';
import {
  InMemorySubjectEventsRepository,
  type StoredSubjectEvent,
} from '../../test-utils/in-memory-subject-events.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { AuthenticateSecretKeyUseCase } from './authenticate-secret-key.usecase';
import { EraseSubjectUseCase } from './erase-subject.usecase';
import { ExportSubjectEventsUseCase } from './export-subject-events.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const SECRET = `${SECRET_KEY_PREFIX}${'S'.repeat(32)}`;
const SECRET_KEY: ProjectKey = {
  id: 'key-1',
  projectId: PROJECT.id,
  kind: 'secret',
  secretHash: hashSecretKey(SECRET),
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  revokedAt: null,
};

let sequence = 0;

function stored(overrides: Partial<StoredSubjectEvent>): StoredSubjectEvent {
  sequence += 1;
  return {
    id: `event-${String(sequence).padStart(4, '0')}`,
    projectId: PROJECT.id,
    userId: null,
    name: 'page_view',
    occurredAt: new Date(Date.UTC(2026, 9, 5, 12, sequence)),
    sessionId: 'session-a',
    path: '/',
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    fromAdClick: false,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties: {},
    ...overrides,
  };
}

describe('AuthenticateSecretKeyUseCase', () => {
  function setup() {
    const keys = new InMemoryProjectRepository();
    keys.add(PROJECT, SECRET_KEY);
    return new AuthenticateSecretKeyUseCase(keys);
  }

  it('finds the live secret key of a bearer header', async () => {
    await expect(setup().execute(`Bearer ${SECRET}`)).resolves.toEqual({
      keyId: 'key-1',
      projectId: 'project-1',
      secretHash: hashSecretKey(SECRET),
    });
  });

  it.each([
    ['no header', undefined],
    ['another scheme', `Basic ${SECRET}`],
    ['a public key', `Bearer pyxis_pk_${'P'.repeat(32)}`],
    ['an unknown secret key', `Bearer ${SECRET_KEY_PREFIX}${'U'.repeat(32)}`],
  ])('refuses %s as an unknown key', async (_case, header) => {
    await expect(setup().execute(header)).rejects.toBeInstanceOf(UnknownProjectKeyError);
  });

  it('refuses a key whose stored hash does not match, whatever the lookup returned', async () => {
    const lying: ProjectKeyRepository = {
      create: () => Promise.reject(new Error('unused')),
      revoke: () => Promise.reject(new Error('unused')),
      findLiveSecret: () =>
        Promise.resolve({ keyId: 'key-x', projectId: 'project-x', secretHash: 'f'.repeat(64) }),
      liveKeysOf: () => Promise.reject(new Error('unused')),
    };

    await expect(
      new AuthenticateSecretKeyUseCase(lying).execute(`Bearer ${SECRET}`),
    ).rejects.toBeInstanceOf(UnknownProjectKeyError);
  });
});

describe('EraseSubjectUseCase', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('erases the person and the visits linked by identify, and logs only the count', async () => {
    const events = new InMemorySubjectEventsRepository();
    events.add(
      stored({ sessionId: 'session-a' }),
      stored({ sessionId: 'session-a', name: 'identify', userId: 'ana' }),
      stored({ sessionId: 'session-b', userId: 'ana' }),
      stored({ sessionId: 'session-c', userId: 'bruno' }),
    );

    const erased = await new EraseSubjectUseCase(events).execute('project-1', 'ana');

    expect(erased).toEqual({ deletedEvents: 3 });
    expect(events.remaining.map((event) => event.userId)).toEqual(['bruno']);
    expect(logs).toEqual([{ message: 'subject.erased', projectId: 'project-1', deletedEvents: 3 }]);
    expect(JSON.stringify(logs)).not.toContain('ana');
  });

  it('answers zero for someone already erased', async () => {
    const events = new InMemorySubjectEventsRepository();

    await expect(new EraseSubjectUseCase(events).execute('project-1', 'ana')).resolves.toEqual({
      deletedEvents: 0,
    });
  });
});

describe('ExportSubjectEventsUseCase', () => {
  it('pages the events in order, with a cursor while there are more', async () => {
    const events = new InMemorySubjectEventsRepository();
    events.add(...Array.from({ length: EXPORT_PAGE_SIZE + 1 }, () => stored({ userId: 'ana' })));
    const exportEvents = new ExportSubjectEventsUseCase(events);

    const first = await exportEvents.execute('project-1', 'ana', null);
    const second = await exportEvents.execute('project-1', 'ana', first.nextAfter);

    expect(first.events).toHaveLength(EXPORT_PAGE_SIZE);
    expect(first.nextAfter).toBe(first.events.at(-1)?.id);
    expect(second.events).toHaveLength(1);
    expect(second.nextAfter).toBeNull();
  });

  it('orders events of the same instant by id, as the database does', async () => {
    const events = new InMemorySubjectEventsRepository();
    const instant = new Date('2026-10-05T12:00:00.000Z');
    events.add(
      stored({ id: 'event-b', userId: 'ana', occurredAt: instant }),
      stored({ id: 'event-a', userId: 'ana', occurredAt: instant }),
    );

    const page = await new ExportSubjectEventsUseCase(events).execute('project-1', 'ana', null);

    expect(page.events.map((event) => event.id)).toEqual(['event-a', 'event-b']);
  });

  it('refuses a cursor that names no event of the project', async () => {
    await expect(
      new ExportSubjectEventsUseCase(new InMemorySubjectEventsRepository()).execute(
        'project-1',
        'ana',
        'event-missing',
      ),
    ).rejects.toBeInstanceOf(UnknownCursorError);
  });
});
