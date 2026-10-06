import type { Project } from '../../domain/entities/project.entity';
import { VISITS_PER_PAGE, type VisitSummary } from '../../domain/queries/timeline';
import { StubTimelineQuery } from '../../test-utils/stub-timeline.query';
import { GetTimelineUseCase } from './get-timeline.usecase';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

function visit(index: number): VisitSummary {
  const startedAt = new Date(Date.UTC(2026, 9, 5, 12) - index * 3_600_000);
  return {
    sessionId: `session-${String(index)}`,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 60_000),
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    channel: index === 0 ? 'paid' : null,
  };
}

describe('GetTimelineUseCase', () => {
  it('shows the visits with their events, newest first, and no cursor on the last page', async () => {
    const query = new StubTimelineQuery();
    query.summaries = [visit(0), visit(1)];
    query.timelineEvents = [
      {
        id: 'e1',
        sessionId: 'session-1',
        occurredAt: visit(1).startedAt,
        name: 'page_view',
        path: '/calculator',
        properties: {},
      },
    ];

    const report = await new GetTimelineUseCase(query).execute(PROJECT, { userId: 'ana' }, null);

    expect(report.nextBefore).toBeNull();
    expect(report.visits.map((shown) => shown.sessionId)).toEqual(['session-0', 'session-1']);
    expect(report.visits[0]?.events).toEqual([]);
    expect(report.visits[1]?.events).toEqual([
      {
        id: 'e1',
        occurredAt: visit(1).startedAt,
        name: 'page_view',
        path: '/calculator',
        properties: {},
      },
    ]);
    expect(query.visitCalls).toEqual([
      {
        projectId: 'project-1',
        subject: { userId: 'ana' },
        before: null,
        limit: VISITS_PER_PAGE + 1,
      },
    ]);
    expect(query.eventCalls).toEqual([
      { projectId: 'project-1', sessionIds: ['session-0', 'session-1'] },
    ]);
  });

  it('pages: one visit more than a page means a cursor at the oldest visit shown', async () => {
    const query = new StubTimelineQuery();
    query.summaries = Array.from({ length: VISITS_PER_PAGE + 1 }, (_, index) => visit(index));
    const before = new Date('2026-10-06T00:00:00.000Z');

    const report = await new GetTimelineUseCase(query).execute(
      PROJECT,
      { sessionId: 'session-3' },
      before,
    );

    expect(report.visits).toHaveLength(VISITS_PER_PAGE);
    expect(report.nextBefore).toEqual(visit(VISITS_PER_PAGE - 1).startedAt);
    expect(query.visitCalls[0]?.before).toBe(before);
    expect(query.eventCalls[0]?.sessionIds).toHaveLength(VISITS_PER_PAGE);
  });

  it('asks for no events when there is no visit', async () => {
    const query = new StubTimelineQuery();

    const report = await new GetTimelineUseCase(query).execute(PROJECT, { userId: 'nobody' }, null);

    expect(report).toEqual({ visits: [], nextBefore: null });
    expect(query.eventCalls).toEqual([]);
  });
});
