import { z } from 'zod';
import type { TrackedEvent } from '../entities/tracked-event.entity';
import { classifyChannel } from '../events/channel';
import { API_REQUEST, PAGE_VIEW } from '../events/reserved-event-names';
import { InvalidRangeError } from '../errors/query.errors';
import { REGION_CODE_PATTERN } from '../events/region';
import { daysIn, todayIn } from '../queries/date-range';
import { demoEventsOfDay, demoPeople, demoVisitCount } from './demo-day';
import {
  DEMO_CONVERSION_EVENT,
  DEMO_DAILY_VARIATION,
  DEMO_PEOPLE,
  DEMO_PLACES,
  DEMO_VISITS_BY_WEEKDAY,
  demoCityOf,
} from './demo-store';
import { seededRandom } from './seeded-random';

const PROJECT_ID = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const DAYS = daysIn({ from: '2026-09-21', to: '2026-10-18' });
const EVENTS_BY_DAY = new Map(
  DAYS.map((day) => [day, demoEventsOfDay(PROJECT_ID, day, 'America/New_York')]),
);
const ALL_EVENTS = [...EVENTS_BY_DAY.values()].flat();
const REQUEST_KEYS = ['duration_ms', 'method', 'route', 'status'];

function visitsOf(events: readonly TrackedEvent[]): Map<string, TrackedEvent[]> {
  const visits = new Map<string, TrackedEvent[]>();
  for (const event of events) {
    visits.set(event.sessionId, [...(visits.get(event.sessionId) ?? []), event]);
  }
  return visits;
}

function byTime(events: readonly TrackedEvent[]): TrackedEvent[] {
  return [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
}

const VISITS = [...visitsOf(ALL_EVENTS).values()].map(byTime);

describe('demoEventsOfDay', () => {
  it('draws the same events for the same project and day, and others for another day', () => {
    const day = '2026-10-14';

    expect(demoEventsOfDay(PROJECT_ID, day, 'America/New_York')).toEqual(EVENTS_BY_DAY.get(day));
    expect(demoEventsOfDay(PROJECT_ID, '2026-10-15', 'America/New_York')).not.toEqual(
      EVENTS_BY_DAY.get(day),
    );
    expect(
      demoEventsOfDay('7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f02', day, 'America/New_York'),
    ).not.toEqual(EVENTS_BY_DAY.get(day));
  });

  it('writes RFC 4122 version 4 ids for events and visits, every event id once', () => {
    const uuid = z.uuid({ version: 'v4' });

    expect(ALL_EVENTS.every((event) => uuid.safeParse(event.id).success)).toBe(true);
    expect(ALL_EVENTS.every((event) => uuid.safeParse(event.sessionId).success)).toBe(true);
    expect(new Set(ALL_EVENTS.map((event) => event.id)).size).toBe(ALL_EVENTS.length);
    expect(ALL_EVENTS.every((event) => event.projectId === PROJECT_ID)).toBe(true);
  });

  it('starts every visit inside its day, in the time zone of the project', () => {
    for (const [day, events] of EVENTS_BY_DAY) {
      const landings = [...visitsOf(events).values()].map((visit) => byTime(visit)[0]);

      expect(landings.every((landing) => landing?.name === PAGE_VIEW)).toBe(true);
      expect(
        landings.every(
          (landing) =>
            landing !== undefined &&
            todayIn('America/New_York', new Date(landing.occurredAt.getTime() - 4000)) <= day &&
            todayIn('America/New_York', landing.occurredAt) >= day,
        ),
      ).toBe(true);
    }
  });

  it('receives every event a few seconds after it happened', () => {
    expect(
      ALL_EVENTS.every((event) => {
        const delay = event.receivedAt.getTime() - event.occurredAt.getTime();
        return delay >= 800 && delay <= 4000;
      }),
    ).toBe(true);
  });

  it('gives the source only to the first page of a visit, with the channel the API would give', () => {
    for (const visit of VISITS) {
      const [landing, ...rest] = visit;

      expect(landing?.attribution).not.toBeNull();
      expect(landing?.channel).toBe(landing?.attribution && classifyChannel(landing.attribution));
      expect(rest.every((event) => event.attribution === null && event.channel === null)).toBe(
        true,
      );
    }
    expect(new Set(VISITS.map((visit) => visit[0]?.channel))).toEqual(
      new Set(['direct', 'organic', 'paid', 'social', 'email', 'referral', 'campaign']),
    );
  });

  it('keeps one device and one place through a visit, as the API stores them', () => {
    for (const visit of VISITS) {
      const traits = new Set(
        visit.map((event) =>
          [event.deviceType, event.browser, event.os, event.country, event.region, event.city].join(
            '|',
          ),
        ),
      );

      expect(traits.size).toBe(1);
    }
    expect(ALL_EVENTS.every((event) => /^[A-Z]{2}$/.test(event.country ?? ''))).toBe(true);
    expect(ALL_EVENTS.every((event) => REGION_CODE_PATTERN.test(event.region ?? ''))).toBe(true);
    expect(ALL_EVENTS.every((event) => (event.regionName ?? '').length <= 64)).toBe(true);
  });

  it('places most visits in a real city of their region, and leaves a few without one', () => {
    const cities = VISITS.map((visit) => visit[0]?.city ?? null);
    const placed = cities.filter((city) => city !== null);
    const regionOfCity = new Map(
      DEMO_PLACES.flatMap(({ item }) => item.cities.map((city) => [city, item.region] as const)),
    );

    expect(placed.length).toBeGreaterThan(cities.length * 0.8);
    expect(placed.length).toBeLessThan(cities.length);
    expect(
      VISITS.every((visit) => {
        const first = visit[0];
        return first?.city == null || regionOfCity.get(first.city) === first.region;
      }),
    ).toBe(true);
  });

  it('identifies a person only from a successful sign-in or sign-up onward', () => {
    for (const visit of VISITS) {
      const firstIdentified = visit.findIndex((event) => event.userId !== null);
      if (firstIdentified === -1) {
        continue;
      }
      const before = visit[firstIdentified - 1];

      expect(before?.name).toBe(API_REQUEST);
      expect(['/sessions', '/sign-up']).toContain(before?.properties.route);
      expect(before?.properties.status).toBeLessThan(400);
      expect(visit.slice(firstIdentified).every((event) => event.userId !== null)).toBe(true);
    }
  });

  it('brings people back on other days, from a stable list of invented ids', () => {
    const people = demoPeople(PROJECT_ID);
    const daysPerPerson = new Map<string, Set<string>>();
    for (const [day, events] of EVENTS_BY_DAY) {
      for (const event of events) {
        if (event.userId !== null) {
          daysPerPerson.set(event.userId, (daysPerPerson.get(event.userId) ?? new Set()).add(day));
        }
      }
    }

    expect(people).toHaveLength(DEMO_PEOPLE);
    expect(people).toEqual(demoPeople(PROJECT_ID));
    expect(people.every((person) => /^cust_[a-z]{8}$/.test(person))).toBe(true);
    expect([...daysPerPerson.keys()].every((person) => people.includes(person))).toBe(true);
    expect(Math.max(...[...daysPerPerson.values()].map((days) => days.size))).toBeGreaterThan(1);
  });

  it('records requests the way the tracker sends them, failures with their codes', () => {
    const requests = ALL_EVENTS.filter((event) => event.name === API_REQUEST);
    const statuses = new Set(requests.map((request) => request.properties.status));
    const errorCodes = new Set(requests.map((request) => request.properties.error_code));

    expect(
      requests.every((request) => {
        const keys = Object.keys(request.properties).sort();
        return (
          keys.join() === REQUEST_KEYS.join() ||
          keys.join() === [...REQUEST_KEYS, 'error_code'].sort().join()
        );
      }),
    ).toBe(true);
    expect(statuses).toEqual(new Set([200, 201, 400, 401, 402, 409, 429, 500, 503]));
    expect(errorCodes).toEqual(
      new Set([
        undefined,
        'card_declined',
        'out_of_stock',
        'email_taken',
        'too_many_attempts',
        'invalid_code',
      ]),
    );
    expect(requests.some((request) => request.properties.method === 'GET')).toBe(true);
    expect(
      requests
        .filter((request) => request.properties.method === 'GET')
        .every((request) => Number(request.properties.status) >= 500),
    ).toBe(true);
  });

  it('converts after a sign-up, and places orders only after a successful one', () => {
    const conversions = VISITS.filter((visit) =>
      visit.some((event) => event.name === DEMO_CONVERSION_EVENT),
    );
    const orders = VISITS.filter((visit) => visit.some((event) => event.name === 'order_placed'));
    const retried = VISITS.filter(
      (visit) => visit.filter((event) => event.properties.route === '/orders').length === 2,
    );

    expect(conversions.length).toBeGreaterThan(0);
    expect(conversions.every((visit) => visit.some((event) => event.path === '/sign-up'))).toBe(
      true,
    );
    expect(orders.length).toBeGreaterThan(0);
    expect(
      orders.every((visit) =>
        visit.some(
          (event) => event.properties.route === '/orders' && event.properties.status === 201,
        ),
      ),
    ).toBe(true);
    expect(retried.length).toBeGreaterThan(0);
    const pricing = VISITS.filter((visit) => visit.some((event) => event.path === '/pricing'));
    const signUpPage = VISITS.filter((visit) => visit.some((event) => event.path === '/sign-up'));
    const started = VISITS.filter((visit) =>
      visit.some((event) => event.name === 'sign_up_started'),
    );
    expect(signUpPage.length).toBeLessThan(pricing.length);
    expect(started.length).toBeLessThan(signUpPage.length);
    expect(ALL_EVENTS.every((event) => event.path.startsWith('/'))).toBe(true);
    expect(ALL_EVENTS.every((event) => event.name.length <= 64)).toBe(true);
  });
});

describe('demoVisitCount', () => {
  it('stays near the visits of its weekday, fewer at the weekend', () => {
    const counts = DAYS.map((day) => ({
      day,
      visits: new Set(EVENTS_BY_DAY.get(day)?.map((event) => event.sessionId)).size,
    }));
    const weekend = counts.filter(({ day }) => [6, 0].includes(new Date(day).getUTCDay()));
    const weekdays = counts.filter(({ day }) => ![6, 0].includes(new Date(day).getUTCDay()));
    const average = (values: readonly { visits: number }[]) =>
      values.reduce((sum, { visits }) => sum + visits, 0) / values.length;

    expect(
      counts.every(
        ({ visits }) =>
          visits >= Math.min(...DEMO_VISITS_BY_WEEKDAY) * (1 - DEMO_DAILY_VARIATION) &&
          visits <= Math.max(...DEMO_VISITS_BY_WEEKDAY) * (1 + DEMO_DAILY_VARIATION),
      ),
    ).toBe(true);
    expect(average(weekend)).toBeLessThan(average(weekdays));
  });

  it('refuses a day the calendar does not know', () => {
    expect(() => demoVisitCount('2026-13-45', seededRandom('nowhere'))).toThrow(InvalidRangeError);
  });
});

describe('demoCityOf', () => {
  const lisbon = {
    country: 'PT',
    region: 'PT-11',
    regionName: 'Lisbon',
    cities: ['Lisbon', 'Sintra'],
  };

  it('picks a city of the place from the end of the visit id, the same one every time', () => {
    expect(demoCityOf(lisbon, '00000000-0000-4000-8000-000000000001')).toBe('Sintra');
    expect(demoCityOf(lisbon, '00000000-0000-4000-8000-000000000002')).toBe('Lisbon');
  });

  it('leaves one visit in ten without a city', () => {
    expect(demoCityOf(lisbon, '00000000-0000-4000-8000-00000000000a')).toBeNull();
  });

  it('gives no city to a place that lists none', () => {
    expect(
      demoCityOf({ ...lisbon, cities: [] }, '00000000-0000-4000-8000-000000000001'),
    ).toBeNull();
  });
});
