import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import {
  ShareLinkNotFoundError,
  SharePasswordRequiredError,
} from '../../../domain/errors/share-link.errors';
import type { Goal } from '../../../domain/goals/goal';
import { VISITORS_OFF } from '../../../domain/queries/visitors';
import type { OverviewReport } from '../../../domain/queries/overview';
import type { DevicesReport } from '../../../domain/queries/devices';
import type { EngagementReport } from '../../../domain/queries/engagement';
import type { ShareLink } from '../../../domain/share-links/share-link';
import type { RequestedRange } from '../../../usecases/queries/scoped-periods';
import type { GetAcquisitionUseCase } from '../../../usecases/queries/get-acquisition.usecase';
import type { GetDevicesUseCase } from '../../../usecases/queries/get-devices.usecase';
import type { GetEngagementUseCase } from '../../../usecases/queries/get-engagement.usecase';
import type { GetFeaturesUseCase } from '../../../usecases/queries/get-features.usecase';
import type { GetFunnelSegmentsUseCase } from '../../../usecases/queries/get-funnel-segments.usecase';
import type { GetFunnelUseCase } from '../../../usecases/queries/get-funnel.usecase';
import type { GetGoalsSummaryUseCase } from '../../../usecases/queries/get-goals-summary.usecase';
import type { GetOverviewUseCase } from '../../../usecases/queries/get-overview.usecase';
import type { GetTimeOfDayUseCase } from '../../../usecases/queries/get-time-of-day.usecase';
import type {
  CreateShareLinkCommand,
  CreateShareLinkUseCase,
} from '../../../usecases/share-links/create-share-link.usecase';
import type {
  ListShareLinksCommand,
  ListShareLinksUseCase,
} from '../../../usecases/share-links/list-share-links.usecase';
import type { OpenShareLinkUseCase } from '../../../usecases/share-links/open-share-link.usecase';
import type {
  RevokeShareLinkCommand,
  RevokeShareLinkUseCase,
} from '../../../usecases/share-links/revoke-share-link.usecase';
import type {
  SetShareLinkPasswordCommand,
  SetShareLinkPasswordUseCase,
} from '../../../usecases/share-links/set-share-link-password.usecase';
import type { ListAnnotationsUseCase } from '../../../usecases/annotations/list-annotations.usecase';
import { annotationListSchema } from '../annotations/annotations.schemas';
import { goalsSummarySchema } from '../goals/goals.schemas';
import { engagementReportSchema } from '../queries/engagement.schemas';
import { funnelSegmentsReportSchema } from '../queries/funnel-segments.schemas';
import { goalsOf, projectOf } from '../queries/project-access.guard';
import {
  acquisitionReportSchema,
  devicesReportSchema,
  featuresReportSchema,
  funnelReportSchema,
  overviewReportSchema,
} from '../queries/query.schemas';
import { timeOfDayReportSchema } from '../queries/time-of-day.schemas';
import { isShareUnlocked, ShareLinkGuard, shareLinkOf } from './share-link.guard';
import { ShareLinksController } from './share-links.controller';
import {
  createdShareLinkSchema,
  createShareLinkSchema,
  sharedProjectSchema,
  shareLinkPasswordSchema,
  shareLinkSchema,
  shareLinksSchema,
} from './share-links.schemas';
import {
  sharedConversionRangeQuerySchema,
  sharedFeaturesQuerySchema,
  sharedFilteredRangeQuerySchema,
  sharedFunnelQuerySchema,
  sharedFunnelSegmentsQuerySchema,
} from './shared-query.schemas';
import { SharedReportsController } from './shared-reports.controller';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'purchase',
  currency: 'USD',
  cityEnabled: true,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const ADMIN: AdminUser = {
  id: '3e0b4f5a-6c7d-4e8f-9a0b-1c2d3e4f5a6b',
  email: 'ana@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const PURCHASE: Goal = {
  id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  projectId: PROJECT.id,
  name: 'Purchase',
  target: { type: 'event', name: 'purchase' },
  position: 1,
  createdAt: new Date('2026-11-04T12:00:00.000Z'),
};
const THANKS: Goal = {
  ...PURCHASE,
  id: '8b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e',
  name: 'Thanks page',
  target: { type: 'page', path: '/thanks/*' },
  position: 2,
};
const LINK: ShareLink = {
  id: '00000000-0000-4000-9000-000000000001',
  projectId: PROJECT.id,
  name: 'For the agency',
  createdAt: new Date('2026-11-05T12:00:00.000Z'),
  expiresAt: new Date('2026-12-05T12:00:00.000Z'),
  passwordProtected: false,
};
const LINK_BODY = {
  id: LINK.id,
  name: 'For the agency',
  created_at: '2026-11-05T12:00:00.000Z',
  expires_at: '2026-12-05T12:00:00.000Z',
  password_protected: false,
};
const TOKEN = `pyxis_sh_${'A'.repeat(32)}`;
const UNLOCK = `pyxis_su_${'U'.repeat(32)}`;
const RANGE = { from: '2026-11-01', to: '2026-11-05' };
const STEPS = [
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'purchase' },
] as const;
const OVERVIEW: OverviewReport = {
  kpis: {
    visits: { current: 3, previous: 2, daily: [3] },
    identifiedUsers: { current: 0, previous: 0, daily: [0] },
    conversions: { current: 1, previous: 0, daily: [1] },
    convertingVisits: { current: 1, previous: 0, daily: [1] },
    revenue: { current: 129.9, previous: 0, daily: [129.9] },
    writeErrors: {
      current: { failed: 0, total: 0 },
      previous: { failed: 0, total: 0 },
      daily: [{ failed: 0, total: 0 }],
    },
  },
  days: [{ date: '2026-11-05', pageViews: 4, events: 1 }],
  topPages: [{ path: '/pricing', views: 2, visits: 2 }],
  topEvents: [{ name: 'purchase', count: 1, visits: 1 }],
  comparisonCutoff: null,
  previousDays: [],
  visitors: VISITORS_OFF,
};
const DEVICES: DevicesReport = {
  deviceType: [{ value: 'desktop', visits: 2, conversions: 1, convertingVisits: 1 }],
  browser: [],
  os: [],
  country: [],
  regions: [],
  cities: [],
  reach: {
    visits: 2,
    continents: 0,
    countries: 0,
    regions: 0,
    cities: 0,
    topCountry: null,
    topRegion: null,
  },
};
const ENGAGEMENT: EngagementReport = {
  visits: 2,
  singlePageVisits: 1,
  medianVisitSeconds: 60,
  visitLengths: [],
  entryPages: [{ path: '/pricing', visits: 2, singlePageVisits: 1 }],
  exitPages: [{ path: '/thanks', visits: 1 }],
};

function contextOf(
  request: FastifyRequest,
  handler: (...args: never[]) => unknown = () => undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

function sharedRequest(): FastifyRequest {
  return {
    shareLink: LINK,
    shareUnlocked: true,
    project: PROJECT,
    goals: [PURCHASE, THANKS],
  } as unknown as FastifyRequest;
}

function recording<T>(answer: T) {
  const calls: unknown[][] = [];
  return {
    calls,
    useCase: {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(answer);
      },
    },
  };
}

function sharedController() {
  const overview = recording(OVERVIEW);
  const timeOfDay = recording(
    Array.from({ length: 7 }, (_, weekday) => ({
      weekday: weekday + 1,
      hours: Array.from({ length: 24 }, () => 0),
    })),
  );
  const goalsSummary = recording({
    visits: 3,
    goals: [
      {
        goal: PURCHASE,
        conversions: 1,
        convertingVisits: 1,
        conversionRate: 1 / 3,
        revenue: 129.9,
      },
    ],
  });
  const acquisition = recording({ days: [], sources: [], campaigns: [], channels: [] });
  const devices = recording(DEVICES);
  const features = recording({ items: [{ name: 'purchase', count: 1, visits: 1, daily: [1] }] });
  const engagement = recording(ENGAGEMENT);
  const funnel = recording({
    steps: [
      { count: 2, medianSecondsFromPrevious: null, revenue: null },
      { count: 1, medianSecondsFromPrevious: 60, revenue: 129.9 },
    ],
    medianSecondsOverall: 60,
  });
  const segments = recording([{ segment: 'desktop', counts: [2, 1] }]);
  const annotations = recording([
    {
      id: '00000000-0000-4000-a000-000000000001',
      projectId: PROJECT.id,
      day: '2026-11-03',
      text: 'Launched the new pricing',
      createdAt: new Date('2026-11-03T15:00:00.000Z'),
      updatedAt: new Date('2026-11-03T15:00:00.000Z'),
    },
  ]);
  return {
    controller: new SharedReportsController(
      overview.useCase as unknown as GetOverviewUseCase,
      timeOfDay.useCase as unknown as GetTimeOfDayUseCase,
      goalsSummary.useCase as unknown as GetGoalsSummaryUseCase,
      acquisition.useCase as unknown as GetAcquisitionUseCase,
      devices.useCase as unknown as GetDevicesUseCase,
      features.useCase as unknown as GetFeaturesUseCase,
      engagement.useCase as unknown as GetEngagementUseCase,
      funnel.useCase as unknown as GetFunnelUseCase,
      segments.useCase as unknown as GetFunnelSegmentsUseCase,
      annotations.useCase as unknown as ListAnnotationsUseCase,
    ),
    overview,
    timeOfDay,
    goalsSummary,
    acquisition,
    devices,
    features,
    engagement,
    funnel,
    segments,
    annotations,
  };
}

function rangeOf(call: unknown[] | undefined, index = 1): RequestedRange {
  return call?.[index] as RequestedRange;
}

describe('ShareLinkGuard', () => {
  function guardOpening(unlocked: boolean) {
    const opened: unknown[][] = [];
    const guard = new ShareLinkGuard(
      {
        execute: (...args: unknown[]) => {
          opened.push(args);
          return Promise.resolve({ link: LINK, project: PROJECT, goals: [PURCHASE], unlocked });
        },
      } as unknown as OpenShareLinkUseCase,
      new Reflector(),
    );
    return { guard, opened };
  }

  it('opens the token of the path and puts the link, project and goals on the request', async () => {
    const { guard, opened } = guardOpening(true);
    const request = { params: { token: TOKEN }, headers: {} } as unknown as FastifyRequest;

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(opened).toEqual([[TOKEN, null]]);
    expect(shareLinkOf(request)).toBe(LINK);
    expect(isShareUnlocked(request)).toBe(true);
    expect(projectOf(request)).toBe(PROJECT);
    expect(goalsOf(request)).toEqual([PURCHASE]);
  });

  it('passes on the unlock sent as a bearer', async () => {
    const { guard, opened } = guardOpening(true);
    const request = {
      params: { token: TOKEN },
      headers: { authorization: `Bearer ${UNLOCK}` },
    } as unknown as FastifyRequest;

    await guard.canActivate(contextOf(request));

    expect(opened).toEqual([[TOKEN, UNLOCK]]);
  });

  it('refuses a report of a locked link with share_password_required', async () => {
    const { guard } = guardOpening(false);
    const request = { params: { token: TOKEN }, headers: {} } as unknown as FastifyRequest;

    await expect(guard.canActivate(contextOf(request))).rejects.toBeInstanceOf(
      SharePasswordRequiredError,
    );
  });

  it('lets a route marked for it read a locked link, and says it is locked', async () => {
    const { guard } = guardOpening(false);
    const request = { params: { token: TOKEN }, headers: {} } as unknown as FastifyRequest;

    await expect(
      guard.canActivate(
        contextOf(
          request,
          Reflect.get(SharedReportsController.prototype, 'project') as () => unknown,
        ),
      ),
    ).resolves.toBe(true);
    expect(isShareUnlocked(request)).toBe(false);
  });

  it('opens an empty token when the path has none, which no link has', async () => {
    const opened: unknown[][] = [];
    const guard = new ShareLinkGuard(
      {
        execute: (...args: unknown[]) => {
          opened.push(args);
          return Promise.reject(new ShareLinkNotFoundError());
        },
      } as unknown as OpenShareLinkUseCase,
      new Reflector(),
    );

    await expect(
      guard.canActivate(contextOf({ params: {}, headers: {} } as unknown as FastifyRequest)),
    ).rejects.toBeInstanceOf(ShareLinkNotFoundError);
    expect(opened).toEqual([['', null]]);
  });

  it('refuses to read a link the guard did not open', () => {
    expect(() => shareLinkOf({} as FastifyRequest)).toThrow('ShareLinkGuard must run');
    expect(() => isShareUnlocked({} as FastifyRequest)).toThrow('ShareLinkGuard must run');
  });
});

describe('SharedReportsController', () => {
  it('answers the project settings the reports need and its goals, never its keys', () => {
    const { controller } = sharedController();

    const body = controller.project(sharedRequest());

    expect(sharedProjectSchema.parse(body)).toEqual({
      password_required: false,
      project: {
        name: 'Shop',
        timezone: 'America/Sao_Paulo',
        currency: 'USD',
        city_enabled: true,
        visitors_enabled: false,
      },
      goals: [
        expect.objectContaining({ id: PURCHASE.id, type: 'event', event: 'purchase' }),
        expect.objectContaining({ id: THANKS.id, type: 'page', path: '/thanks/*' }),
      ],
      expires_at: '2026-12-05T12:00:00.000Z',
    });
  });

  it('answers a link that never expires with a null expiry', () => {
    const { controller } = sharedController();
    const request = { ...sharedRequest(), shareLink: { ...LINK, expiresAt: null } };

    expect(controller.project(request as unknown as FastifyRequest)).toMatchObject({
      password_required: false,
      expires_at: null,
    });
  });

  it('answers only password_required for a locked link, nothing about the project', () => {
    const { controller } = sharedController();
    const request = { ...sharedRequest(), shareUnlocked: false };

    expect(
      sharedProjectSchema.parse(controller.project(request as unknown as FastifyRequest)),
    ).toEqual({ password_required: true });
  });

  it('reads the overview of the shared project for the chosen goal', async () => {
    const { controller, overview } = sharedController();

    const body = await controller.overview(
      sharedRequest(),
      sharedConversionRangeQuerySchema.parse({ ...RANGE, goal: THANKS.id, channel: 'direct' }),
    );

    expect(overviewReportSchema.parse(body).kpis.revenue).toEqual({
      current: 129.9,
      previous: 0,
      daily: [129.9],
    });
    expect(overview.calls[0]?.[0]).toBe(PROJECT);
    expect(rangeOf(overview.calls[0])).toMatchObject({
      ...RANGE,
      conversion: THANKS.target,
      filters: { channel: 'direct' },
    });
  });

  it('reads the time of day and the goals summary of the shared project', async () => {
    const { controller, timeOfDay, goalsSummary } = sharedController();
    const query = sharedFilteredRangeQuerySchema.parse(RANGE);

    const hours = await controller.timeOfDay(sharedRequest(), query);
    const summary = await controller.goalsSummary(sharedRequest(), query);

    expect(timeOfDayReportSchema.parse(hours).weekdays).toHaveLength(7);
    expect(goalsSummarySchema.parse(summary)).toMatchObject({
      visits: 3,
      goals: [{ name: 'Purchase', revenue: 129.9 }],
    });
    expect(timeOfDay.calls[0]?.[0]).toBe(PROJECT);
    expect(goalsSummary.calls[0]?.[1]).toEqual([PURCHASE, THANKS]);
    expect(rangeOf(goalsSummary.calls[0], 2)).toMatchObject(RANGE);
  });

  it('reads acquisition and devices with the dashboard filters', async () => {
    const { controller, acquisition, devices } = sharedController();
    const query = sharedConversionRangeQuerySchema.parse({ ...RANGE, device: 'desktop' });

    const channels = await controller.acquisition(sharedRequest(), query);
    const places = await controller.devices(sharedRequest(), query);

    expect(acquisitionReportSchema.parse(channels)).toEqual({
      days: [],
      sources: [],
      campaigns: [],
      channels: [],
    });
    expect(devicesReportSchema.parse(places).device_types).toEqual([
      { value: 'desktop', visits: 2, conversions: 1, converting_visits: 1 },
    ]);
    expect(rangeOf(acquisition.calls[0]).filters).toMatchObject({ deviceType: 'desktop' });
    expect(rangeOf(devices.calls[0]).conversion).toEqual(PURCHASE.target);
  });

  it('reads the features of the kind asked and the engagement', async () => {
    const { controller, features, engagement } = sharedController();

    const items = await controller.features(
      sharedRequest(),
      sharedFeaturesQuerySchema.parse({ ...RANGE, kind: 'screens' }),
    );
    const shape = await controller.engagement(
      sharedRequest(),
      sharedFilteredRangeQuerySchema.parse(RANGE),
    );

    expect(featuresReportSchema.parse(items).items).toEqual([
      { name: 'purchase', count: 1, visits: 1, daily: [1] },
    ]);
    expect(engagementReportSchema.parse(shape)).toMatchObject({ visits: 2, single_page_visits: 1 });
    expect(features.calls[0]?.[2]).toBe('screens');
    expect(engagement.calls[0]?.[0]).toBe(PROJECT);
  });

  it('reads the notes of the range, which explain the charts', async () => {
    const { controller, annotations } = sharedController();

    const body = await controller.annotations(sharedRequest(), RANGE);

    expect(annotationListSchema.parse(body)).toEqual({
      annotations: [
        {
          id: '00000000-0000-4000-a000-000000000001',
          day: '2026-11-03',
          text: 'Launched the new pricing',
          created_at: '2026-11-03T15:00:00.000Z',
          updated_at: '2026-11-03T15:00:00.000Z',
        },
      ],
    });
    expect(annotations.calls).toEqual([[PROJECT, RANGE.from, RANGE.to]]);
  });

  it('reads the funnel and its segments for the steps asked', async () => {
    const { controller, funnel, segments } = sharedController();
    const steps = JSON.stringify(STEPS);

    const reached = await controller.funnel(
      sharedRequest(),
      sharedFunnelQuerySchema.parse({ ...RANGE, mode: 'user', steps }),
    );
    const split = await controller.funnelSegments(
      sharedRequest(),
      sharedFunnelSegmentsQuerySchema.parse({ ...RANGE, by: 'device', steps }),
    );

    expect(funnelReportSchema.parse(reached)).toEqual({
      steps: [
        { count: 2, median_seconds_from_previous: null, revenue: null },
        { count: 1, median_seconds_from_previous: 60, revenue: 129.9 },
      ],
      median_seconds_overall: 60,
    });
    expect(funnelSegmentsReportSchema.parse(split)).toEqual({
      by: 'device',
      segments: [{ segment: 'desktop', steps: [2, 1] }],
    });
    expect(funnel.calls[0]?.slice(2)).toEqual(['user', STEPS]);
    expect(segments.calls[0]?.slice(2)).toEqual([STEPS, 'device']);
  });
});

describe('ShareLinksController', () => {
  function ownerController() {
    const created: CreateShareLinkCommand[] = [];
    const listed: ListShareLinksCommand[] = [];
    const revoked: RevokeShareLinkCommand[] = [];
    const passwords: SetShareLinkPasswordCommand[] = [];
    return {
      controller: new ShareLinksController(
        {
          execute: (command: CreateShareLinkCommand) => {
            created.push(command);
            return Promise.resolve({
              link: {
                ...LINK,
                name: command.name,
                expiresAt: command.expiresAt,
                passwordProtected: command.password !== null,
              },
              token: TOKEN,
            });
          },
        } as unknown as CreateShareLinkUseCase,
        {
          execute: (command: ListShareLinksCommand) => {
            listed.push(command);
            return Promise.resolve([LINK]);
          },
        } as unknown as ListShareLinksUseCase,
        {
          execute: (command: RevokeShareLinkCommand) => {
            revoked.push(command);
            return Promise.resolve();
          },
        } as unknown as RevokeShareLinkUseCase,
        {
          execute: (command: SetShareLinkPasswordCommand) => {
            passwords.push(command);
            return Promise.resolve({ ...LINK, passwordProtected: command.password !== null });
          },
        } as unknown as SetShareLinkPasswordUseCase,
      ),
      created,
      listed,
      revoked,
      passwords,
    };
  }

  const ownerRequest = { admin: ADMIN } as unknown as FastifyRequest;

  it('creates a link for the signed-in admin and answers its token once', async () => {
    const { controller, created } = ownerController();

    const body = await controller.create(
      ownerRequest,
      PROJECT.id,
      createShareLinkSchema.parse({ name: ' For the agency ', expires_at: LINK_BODY.expires_at }),
    );

    expect(createdShareLinkSchema.parse(body)).toEqual({ ...LINK_BODY, token: TOKEN });
    expect(created).toEqual([
      {
        adminUserId: ADMIN.id,
        projectId: PROJECT.id,
        name: 'For the agency',
        expiresAt: LINK.expiresAt,
        password: null,
      },
    ]);
  });

  it('creates a link that never expires when no expiry is sent', async () => {
    const { controller, created } = ownerController();

    const body = await controller.create(
      ownerRequest,
      PROJECT.id,
      createShareLinkSchema.parse({ name: 'Board' }),
    );

    expect(body.expires_at).toBeNull();
    expect(created[0]?.expiresAt).toBeNull();
  });

  it('lists the links without their tokens', async () => {
    const { controller, listed } = ownerController();

    const body = await controller.list(ownerRequest, PROJECT.id);

    expect(shareLinksSchema.parse(body)).toEqual({ links: [LINK_BODY] });
    expect(listed).toEqual([{ adminUserId: ADMIN.id, projectId: PROJECT.id }]);
  });

  it('creates a link with a password, kept as typed', async () => {
    const { controller, created } = ownerController();

    const body = await controller.create(
      ownerRequest,
      PROJECT.id,
      createShareLinkSchema.parse({ name: 'Board', password: ' correct horse ' }),
    );

    expect(body.password_protected).toBe(true);
    expect(created[0]?.password).toBe(' correct horse ');
  });

  it.each([
    ['sets', 'battery staple', true],
    ['removes', null, false],
  ])('%s the password of a link', async (_case, password, isProtected) => {
    const { controller, passwords } = ownerController();

    const body = await controller.changePassword(
      ownerRequest,
      PROJECT.id,
      LINK.id,
      shareLinkPasswordSchema.parse({ password }),
    );

    expect(shareLinkSchema.parse(body)).toEqual({ ...LINK_BODY, password_protected: isProtected });
    expect(passwords).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, linkId: LINK.id, password },
    ]);
  });

  it.each([
    ['no password field', {}],
    ['a password of a number', { password: 12345678 }],
    ['a password too long for the edge', { password: 'x'.repeat(513) }],
  ])('refuses a password body with %s at the edge', (_case, body) => {
    expect(shareLinkPasswordSchema.safeParse(body).success).toBe(false);
  });

  it('revokes one link of the project', async () => {
    const { controller, revoked } = ownerController();

    await controller.revoke(ownerRequest, PROJECT.id, LINK.id);

    expect(revoked).toEqual([{ adminUserId: ADMIN.id, projectId: PROJECT.id, linkId: LINK.id }]);
  });

  it.each([
    ['an unknown field', { name: 'Board', pin: 'secret' }],
    ['an expiry with no time', { name: 'Board', expires_at: '2026-12-05' }],
    ['a blank name', { name: '   ' }],
  ])('refuses a body with %s at the edge', (_case, body) => {
    expect(createShareLinkSchema.safeParse(body).success).toBe(false);
  });
});
