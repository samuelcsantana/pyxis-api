import { demoEventsOfDay } from '../../domain/demo-traffic/demo-day';
import { daysIn } from '../../domain/queries/date-range';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryDemoTrafficRepository } from '../../test-utils/in-memory-demo-traffic.repository';
import { InMemoryEventRepository } from '../../test-utils/in-memory-event.repository';
import {
  DEMO_TRAFFIC_BACKFILL_DAYS,
  DEMO_TRAFFIC_INSERT_BATCH,
  GenerateDemoTrafficUseCase,
} from './generate-demo-traffic.usecase';

const DEMO_ID = '8e9f0a1b-2c3d-4e4f-9a5b-6c7d8e9f0a01';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function dueEvents(from: string, to: string, now: Date): number {
  return daysIn({ from, to })
    .flatMap((day) => demoEventsOfDay(DEMO_ID, day, 'UTC'))
    .filter((event) => event.receivedAt <= now).length;
}

function setup(lastEventAt: Date | null = null) {
  const projects = new InMemoryDemoTrafficRepository();
  projects.add({
    projectId: DEMO_ID,
    projectName: 'Demo store',
    accountId: null,
    demoTraffic: true,
    lastEventAt,
  });
  const events = new InMemoryEventRepository();
  const clock = new FixedClock(NOW);
  return {
    projects,
    events,
    clock,
    generate: new GenerateDemoTrafficUseCase(projects, events, clock),
  };
}

function latest(events: InMemoryEventRepository): Date {
  return new Date(Math.max(...events.stored.map((event) => event.occurredAt.getTime())));
}

describe('GenerateDemoTrafficUseCase', () => {
  it(`fills the ${String(DEMO_TRAFFIC_BACKFILL_DAYS)} days before today the first time, and today up to now`, async () => {
    const { generate, events } = setup();

    const report = await generate.execute();

    expect(report).toEqual({ projects: 1, inserted: dueEvents('2026-07-21', '2026-10-19', NOW) });
    expect(events.stored).toHaveLength(report.inserted);
    expect(events.insertCalls).toBe(Math.ceil(report.inserted / DEMO_TRAFFIC_INSERT_BATCH));
    expect(events.stored.every((event) => event.receivedAt <= NOW)).toBe(true);
    expect(
      events.stored.some((event) => event.occurredAt >= new Date('2026-10-19T00:00:00.000Z')),
    ).toBe(true);
  });

  it('adds nothing twice, and the next day only what happened since', async () => {
    const { generate, events, projects, clock } = setup();
    await generate.execute();
    projects.add({
      projectId: DEMO_ID,
      projectName: 'Demo store',
      accountId: null,
      demoTraffic: true,
      lastEventAt: latest(events),
    });
    const firstRun = events.stored.length;

    const again = await generate.execute();
    clock.advanceBy(DAY_MS);
    const nextDay = await generate.execute();

    expect(again.inserted).toBe(0);
    expect(nextDay.inserted).toBe(
      dueEvents('2026-10-19', '2026-10-20', clock.now()) -
        dueEvents('2026-10-19', '2026-10-19', NOW),
    );
    expect(events.stored).toHaveLength(firstRun + nextDay.inserted);
  });

  it(`goes back no further than ${String(DEMO_TRAFFIC_BACKFILL_DAYS)} days after a long stop`, async () => {
    const { generate } = setup(new Date('2026-01-10T12:00:00.000Z'));

    expect((await generate.execute()).inserted).toBe(dueEvents('2026-07-21', '2026-10-19', NOW));
  });

  it('fills only today when the latest event is dated after it', async () => {
    const { generate } = setup(new Date('2026-10-25T12:00:00.000Z'));

    expect((await generate.execute()).inserted).toBe(dueEvents('2026-10-19', '2026-10-19', NOW));
  });

  it('does nothing when no project is marked', async () => {
    const projects = new InMemoryDemoTrafficRepository();
    const events = new InMemoryEventRepository();
    const generate = new GenerateDemoTrafficUseCase(projects, events, new FixedClock(NOW));

    expect(await generate.execute()).toEqual({ projects: 0, inserted: 0 });
    expect(events.insertCalls).toBe(0);
  });
});
