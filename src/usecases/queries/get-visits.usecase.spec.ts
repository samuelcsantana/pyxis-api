import type { Project } from '../../domain/entities/project.entity';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import {
  NO_VISIT_FILTERS,
  VISIT_LIST_PAGE_SIZE,
  type VisitFilters,
  type VisitListItem,
} from '../../domain/queries/visits';
import { FixedClock } from '../../test-utils/fixed-clock';
import { StubVisitsQuery } from '../../test-utils/stub-visits.query';
import { GetVisitsUseCase } from './get-visits.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const CLOCK = new FixedClock(new Date('2026-10-06T02:30:00.000Z'));
const RANGE = { from: '2026-10-04', to: '2026-10-05' };

function item(index: number): VisitListItem {
  const startedAt = new Date(Date.UTC(2026, 9, 5, 20) - index * 60_000);
  return {
    sessionId: `session-${String(index)}`,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 30_000),
    entryPath: '/calculator',
    pageViews: 2,
    highlights: ['calculator_result_shown'],
    failedRequests: 0,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    channel: 'paid',
    source: 'google',
    campaign: 'spring_sale',
    userId: null,
  };
}

describe('GetVisitsUseCase', () => {
  it('asks one visit more than a page, in the project time zone, with the filters as given', async () => {
    const query = new StubVisitsQuery();
    query.items = [item(0), item(1)];
    query.total = 2;
    const filters: VisitFilters = {
      ...NO_VISIT_FILTERS,
      paths: ['/calculator-*'],
      identity: 'anonymous',
      country: 'BR',
      route: { method: 'POST', route: '/orders' },
      failed: true,
    };

    const report = await new GetVisitsUseCase(query, CLOCK).execute(PROJECT, RANGE, filters, null);

    expect(report).toEqual({ visits: [item(0), item(1)], nextCursor: null, total: 2 });
    expect(query.calls).toEqual([
      {
        scope: {
          projectId: 'project-1',
          timeZone: 'America/Sao_Paulo',
          conversionEvent: 'signup_completed',
          range: RANGE,
        },
        filters,
        after: null,
        limit: VISIT_LIST_PAGE_SIZE + 1,
      },
    ]);
  });

  it('shows a full page and points the cursor at its last visit when more exist', async () => {
    const query = new StubVisitsQuery();
    query.items = Array.from({ length: VISIT_LIST_PAGE_SIZE + 1 }, (_, index) => item(index));
    const after = { startedAt: new Date('2026-10-05T21:00:00.000Z'), sessionId: 'session-x' };

    const report = await new GetVisitsUseCase(query, CLOCK).execute(
      PROJECT,
      RANGE,
      NO_VISIT_FILTERS,
      after,
    );

    const last = item(VISIT_LIST_PAGE_SIZE - 1);
    expect(report.total).toBe(0);
    expect(report.visits).toHaveLength(VISIT_LIST_PAGE_SIZE);
    expect(report.nextCursor).toEqual({ startedAt: last.startedAt, sessionId: last.sessionId });
    expect(query.calls[0]?.after).toBe(after);
  });

  it('refuses a range that ends after today in the project time zone', async () => {
    const query = new StubVisitsQuery();

    await expect(
      new GetVisitsUseCase(query, CLOCK).execute(
        PROJECT,
        { from: '2026-10-05', to: '2026-10-06' },
        NO_VISIT_FILTERS,
        null,
      ),
    ).rejects.toBeInstanceOf(InvalidRangeError);
    expect(query.calls).toEqual([]);
  });
});
