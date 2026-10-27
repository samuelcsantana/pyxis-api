import { MAX_OCCURRED_AT_AGE_MS } from '../events/event-limits';
import {
  ACTIVE_VISIT_WINDOW_MS,
  ARRIVALS_LOOKBACK_MS,
  arrivalsAsk,
  arrivalsReport,
  arrivalTimes,
  clampedSince,
  MAX_ARRIVAL_TIMES,
} from './arrivals';
import type { QueryScope } from './query-scope';
import { NO_REPORT_FILTERS } from './report-filters';

const AS_OF = new Date('2026-10-23T17:05:12.000Z');
const SCOPE: QueryScope = {
  projectId: 'project-1',
  timeZone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-23', to: '2026-10-23' },
  filters: NO_REPORT_FILTERS,
};

function secondsBefore(seconds: number): Date {
  return new Date(AS_OF.getTime() - seconds * 1000);
}

describe('arrival limits', () => {
  it('look back as far as an event may arrive late, show 5 minutes as now, and cap at 100', () => {
    expect(ARRIVALS_LOOKBACK_MS).toBe(MAX_OCCURRED_AT_AGE_MS);
    expect(ARRIVALS_LOOKBACK_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(ACTIVE_VISIT_WINDOW_MS).toBe(300_000);
    expect(MAX_ARRIVAL_TIMES).toBe(100);
  });
});

describe('clampedSince', () => {
  it('keeps a moment of the last 7 days', () => {
    expect(clampedSince(secondsBefore(60), AS_OF)).toEqual(secondsBefore(60));
  });

  it('starts no earlier than 7 days before now', () => {
    expect(clampedSince(new Date('2026-09-01T00:00:00.000Z'), AS_OF)).toEqual(
      new Date(AS_OF.getTime() - ARRIVALS_LOOKBACK_MS),
    );
  });

  it('starts no later than now', () => {
    expect(clampedSince(new Date('2026-10-24T00:00:00.000Z'), AS_OF)).toEqual(AS_OF);
  });
});

describe('arrivalsAsk', () => {
  it('asks one more time than it shows, so it knows when there are more', () => {
    expect(arrivalsAsk(SCOPE, new Date('2026-01-01T00:00:00.000Z'), AS_OF)).toEqual({
      scope: SCOPE,
      since: new Date('2026-10-16T17:05:12.000Z'),
      activeSince: new Date('2026-10-23T17:00:12.000Z'),
      limit: 101,
    });
  });
});

describe('arrivalTimes', () => {
  it('rounds each time up to the second, so a mark taken in that second never hides it', () => {
    expect(
      arrivalTimes([new Date('2026-10-23T17:04:58.200Z'), new Date('2026-10-23T17:04:57.000Z')]),
    ).toEqual({
      times: [new Date('2026-10-23T17:04:59.000Z'), new Date('2026-10-23T17:04:57.000Z')],
      more: false,
    });
  });

  it('shows at most 100 times and says when there were more', () => {
    const times = Array.from({ length: 101 }, (_, index) => secondsBefore(index));

    const shown = arrivalTimes(times);

    expect(shown.times).toHaveLength(100);
    expect(shown.times[0]).toEqual(AS_OF);
    expect(shown.more).toBe(true);
    expect(arrivalTimes(times.slice(0, 100)).more).toBe(false);
  });
});

describe('arrivalsReport', () => {
  it('reports each kind, and no conversions for a project without a conversion event', () => {
    const rows = {
      visits: [secondsBefore(14)],
      conversions: null,
      namedEvents: [],
      failedRequests: [secondsBefore(3)],
      activeVisits: 4,
    };

    expect(arrivalsReport(rows, AS_OF)).toEqual({
      asOf: AS_OF,
      activeVisits: 4,
      visits: { times: [secondsBefore(14)], more: false },
      conversions: null,
      namedEvents: { times: [], more: false },
      failedRequests: { times: [secondsBefore(3)], more: false },
    });
    expect(arrivalsReport({ ...rows, conversions: [] }, AS_OF).conversions).toEqual({
      times: [],
      more: false,
    });
  });
});
