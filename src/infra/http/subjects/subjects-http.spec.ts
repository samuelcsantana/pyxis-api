import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { ProjectKey } from '../../../domain/entities/project-key.entity';
import type { Project } from '../../../domain/entities/project.entity';
import { UnknownProjectKeyError } from '../../../domain/errors/ingest.errors';
import { hashSecretKey, SECRET_KEY_PREFIX } from '../../../domain/keys/project-keys';
import type { SubjectEventsPage } from '../../../domain/subjects/subject-events';
import { InMemoryProjectRepository } from '../../../test-utils/in-memory-project.repository';
import { AuthenticateSecretKeyUseCase } from '../../../usecases/subjects/authenticate-secret-key.usecase';
import type { EraseSubjectUseCase } from '../../../usecases/subjects/erase-subject.usecase';
import type { ExportSubjectEventsUseCase } from '../../../usecases/subjects/export-subject-events.usecase';
import { ClientRateLimitedError } from '../errors/http-errors';
import { SecretKeyThrottlerGuard } from './secret-key-throttler.guard';
import { SecretKeyGuard, secretKeyOf } from './secret-key.guard';
import { erasedSubjectSchema, subjectEventsSchema } from './subject.schemas';
import { SubjectsController } from './subjects.controller';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const SECRET = `${SECRET_KEY_PREFIX}${'H'.repeat(32)}`;
const KEY: ProjectKey = {
  id: 'key-1',
  projectId: PROJECT.id,
  kind: 'secret',
  secretHash: hashSecretKey(SECRET),
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  revokedAt: null,
};
const LIVE_KEY = { keyId: 'key-1', projectId: 'project-1', secretHash: hashSecretKey(SECRET) };

function contextOf(request: FastifyRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

class InspectableThrottlerGuard extends SecretKeyThrottlerGuard {
  trackerOf(request: FastifyRequest): Promise<string> {
    return this.getTracker(request);
  }

  refuse(): Promise<void> {
    return this.throwThrottlingException(
      {} as ExecutionContext,
      {
        timeToBlockExpire: 42,
      } as Parameters<SecretKeyThrottlerGuard['throwThrottlingException']>[1],
    );
  }
}

describe('SecretKeyGuard', () => {
  function guard() {
    const keys = new InMemoryProjectRepository();
    keys.add(PROJECT, KEY);
    return new SecretKeyGuard(new AuthenticateSecretKeyUseCase(keys));
  }

  it('puts the live secret key of the bearer header on the request', async () => {
    const request = { headers: { authorization: `Bearer ${SECRET}` } } as unknown as FastifyRequest;

    await expect(guard().canActivate(contextOf(request))).resolves.toBe(true);
    expect(secretKeyOf(request)).toEqual(LIVE_KEY);
  });

  it('refuses a request without a known key', async () => {
    const request = { headers: {} } as unknown as FastifyRequest;

    await expect(guard().canActivate(contextOf(request))).rejects.toBeInstanceOf(
      UnknownProjectKeyError,
    );
  });

  it('fails loudly when a route reads the key without the guard', () => {
    expect(() => secretKeyOf({} as FastifyRequest)).toThrow('SecretKeyGuard must run before');
  });
});

describe('SecretKeyThrottlerGuard', () => {
  const throttler = Object.create(InspectableThrottlerGuard.prototype) as InspectableThrottlerGuard;

  it('counts the calls of each key, never of an address', async () => {
    const request = { secretKey: LIVE_KEY, ip: '203.0.113.9' } as unknown as FastifyRequest;

    await expect(throttler.trackerOf(request)).resolves.toBe('key-1');
  });

  it('answers a refusal with the time to wait', async () => {
    await expect(throttler.refuse()).rejects.toEqual(new ClientRateLimitedError(42));
  });
});

describe('SubjectsController', () => {
  const PAGE: SubjectEventsPage = {
    events: [
      {
        id: '9f1c2b3a-1d2e-4f5a-8b6c-000000000001',
        name: 'calculator_used',
        occurredAt: new Date('2026-10-04T12:03:00.000Z'),
        sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
        path: '/calculator',
        referrerHost: 'duckduckgo.com',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        fromAdClick: false,
        deviceType: 'mobile',
        browser: 'safari',
        os: 'ios',
        country: 'BR',
        properties: { plan: 'mei' },
      },
    ],
    nextAfter: null,
  };

  function controller() {
    const calls: unknown[][] = [];
    const answering = (answer: unknown) => ({
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(answer);
      },
    });
    return {
      calls,
      subjects: new SubjectsController(
        answering({ deletedEvents: 4 }) as unknown as EraseSubjectUseCase,
        answering(PAGE) as unknown as ExportSubjectEventsUseCase,
      ),
    };
  }

  const request = { secretKey: LIVE_KEY } as unknown as FastifyRequest;

  it('erases in the project of the key and answers the count', async () => {
    const { subjects, calls } = controller();

    const body = await subjects.erase(request, 'ana');

    expect(erasedSubjectSchema.parse(body)).toEqual({ deleted_events: 4 });
    expect(calls).toEqual([['project-1', 'ana']]);
  });

  it('exports a page in snake case, from the cursor when one is given', async () => {
    const { subjects, calls } = controller();

    const body = await subjects.events(request, 'ana', {});
    await subjects.events(request, 'ana', { after: '9f1c2b3a-1d2e-4f5a-8b6c-000000000001' });

    expect(subjectEventsSchema.parse(body).events[0]).toMatchObject({
      occurred_at: '2026-10-04T12:03:00.000Z',
      session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
      referrer_host: 'duckduckgo.com',
      from_ad_click: false,
      properties: { plan: 'mei' },
    });
    expect(body.next_after).toBeNull();
    expect(calls).toEqual([
      ['project-1', 'ana', null],
      ['project-1', 'ana', '9f1c2b3a-1d2e-4f5a-8b6c-000000000001'],
    ]);
  });
});
