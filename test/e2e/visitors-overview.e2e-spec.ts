import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import type { VisitorKind } from '../../src/domain/events/visitor-kind';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER } from './env-setup';

const NOW = new Date('2026-11-02T15:00:00.000Z');
const ORIGIN = 'https://visitors.example.com';
const COUNTING_ID = 'd6e7f8a9-0b1c-4d2e-8f3a-4b5c6d7e8f91';
const COUNTING_KEY = `${PUBLIC_KEY_PREFIX}${'G'.repeat(32)}`;
const NOT_COUNTING_ID = 'd6e7f8a9-0b1c-4d2e-8f3a-4b5c6d7e8f92';
const NOT_COUNTING_KEY = `${PUBLIC_KEY_PREFIX}${'H'.repeat(32)}`;
const ADMIN_ID = 'd6e7f8a9-0b1c-4d2e-8f3a-4b5c6d7e8f93';
const SESSION_TOKEN = 'e2e-visitors-overview-session-token';
const ONE_MINUTE_MS = 60_000;
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

interface VisitStart {
  readonly visit: number;
  readonly at: string;
  readonly visitor: VisitorKind | null;
}

const VISIT_STARTS: readonly VisitStart[] = [
  { visit: 1, at: '2026-10-31T13:00:00.000Z', visitor: 'first_visit' },
  { visit: 2, at: '2026-11-01T02:30:00.000Z', visitor: 'first_this_month' },
  { visit: 3, at: '2026-11-01T12:00:00.000Z', visitor: 'first_visit' },
  { visit: 4, at: '2026-11-01T13:00:00.000Z', visitor: 'first_this_month' },
  { visit: 5, at: '2026-11-01T14:00:00.000Z', visitor: 'first_today' },
  { visit: 6, at: '2026-11-02T11:00:00.000Z', visitor: 'first_today' },
  { visit: 7, at: '2026-11-02T12:00:00.000Z', visitor: 'again_today' },
  { visit: 8, at: '2026-11-02T13:00:00.000Z', visitor: null },
];

function uuidEnding(prefix: string, index: number): string {
  return `${prefix}-0b1c-4d2e-8f3a-${String(index).padStart(12, '0')}`;
}

function eventsOf(start: VisitStart, project: number): Record<string, unknown>[] {
  const visit = {
    name: 'page_view',
    session_id: uuidEnding('e7f8a9b0', project * 100 + start.visit),
  };
  const firstEventId = project * 1000 + start.visit * 10;
  return [
    {
      ...visit,
      id: uuidEnding('f8a9b0c1', firstEventId),
      occurred_at: start.at,
      path: '/',
      ...(start.visitor === null ? {} : { visitor: start.visitor }),
    },
    {
      ...visit,
      id: uuidEnding('f8a9b0c1', firstEventId + 1),
      occurred_at: new Date(new Date(start.at).getTime() + ONE_MINUTE_MS).toISOString(),
      path: '/pricing',
    },
  ];
}

function quietDay(date: string) {
  return { date, first_visit: 0, first_this_month: 0, first_today: 0, again_today: 0 };
}

describe('unique visitors on the overview', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let clientCounter = 0;

  const overview = (projectId: string, from: string, to: string) =>
    app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/overview?from=${from}&to=${to}`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}` },
    });

  const sendVisits = async (key: string, project: number) => {
    clientCounter += 1;
    const response = await app.inject({
      method: 'POST',
      url: '/v1/batch',
      payload: JSON.stringify({
        key,
        sent_at: NOW.toISOString(),
        events: VISIT_STARTS.flatMap((start) => eventsOf(start, project)),
      }),
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'user-agent': SAFARI_IPHONE,
        origin: ORIGIN,
        [E2E_CLIENT_IP_HEADER]: `203.0.113.${String(clientCounter)}`,
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ accepted: VISIT_STARTS.length * 2, rejected: 0 });
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, visitors_enabled)
      VALUES (${COUNTING_ID}, 'Counting store', ${[ORIGIN]}, 'America/Sao_Paulo', true),
             (${NOT_COUNTING_ID}, 'Quiet store', ${[ORIGIN]}, 'America/Sao_Paulo', false)
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key)
      VALUES (${COUNTING_ID}, 'public', ${COUNTING_KEY}),
             (${NOT_COUNTING_ID}, 'public', ${NOT_COUNTING_KEY})
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, 'visitors@example.com')`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${COUNTING_ID}), (${ADMIN_ID}, ${NOT_COUNTING_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
    await sendVisits(COUNTING_KEY, 1);
    await sendVisits(NOT_COUNTING_KEY, 2);
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('counts the visits that started each local day by kind, and the month to date as exact', async () => {
    const response = await overview(COUNTING_ID, '2026-11-01', '2026-11-02');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      comparison_cutoff: '12:00:00.000',
      visitors: {
        enabled: true,
        daily: [
          {
            date: '2026-11-01',
            first_visit: 1,
            first_this_month: 1,
            first_today: 1,
            again_today: 0,
          },
          {
            date: '2026-11-02',
            first_visit: 0,
            first_this_month: 0,
            first_today: 1,
            again_today: 1,
          },
        ],
        months: [{ month: '2026-11', first_visit: 1, first_this_month: 1, exact: true }],
        previous_daily: [quietDay('2026-10-30'), { ...quietDay('2026-10-31'), first_visit: 1 }],
        previous_months: [{ month: '2026-10', first_visit: 1, first_this_month: 0, exact: false }],
      },
    });
  });

  it('counts 23:30 in Sao Paulo on that day, and a month the range only ends in as partial', async () => {
    const response = await overview(COUNTING_ID, '2026-10-31', '2026-11-02');

    expect(response.json()).toMatchObject({
      visitors: {
        daily: [
          {
            date: '2026-10-31',
            first_visit: 1,
            first_this_month: 1,
            first_today: 0,
            again_today: 0,
          },
          {
            date: '2026-11-01',
            first_visit: 1,
            first_this_month: 1,
            first_today: 1,
            again_today: 0,
          },
          {
            date: '2026-11-02',
            first_visit: 0,
            first_this_month: 0,
            first_today: 1,
            again_today: 1,
          },
        ],
        months: [
          { month: '2026-10', first_visit: 1, first_this_month: 1, exact: false },
          { month: '2026-11', first_visit: 1, first_this_month: 1, exact: true },
        ],
      },
    });
  });

  it('answers the option off, with empty lists, for a project that does not count visitors', async () => {
    const response = await overview(NOT_COUNTING_ID, '2026-11-01', '2026-11-02');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      kpis: { visits: { current: 6 } },
      visitors: { enabled: false, daily: [], months: [], previous_daily: [], previous_months: [] },
    });
  });

  it('counts nothing sent while the option was off once it is turned on', async () => {
    await owner`UPDATE projects SET visitors_enabled = true WHERE id = ${NOT_COUNTING_ID}`;

    const response = await overview(NOT_COUNTING_ID, '2026-11-01', '2026-11-02');

    expect(response.json()).toMatchObject({
      visitors: {
        enabled: true,
        daily: [quietDay('2026-11-01'), quietDay('2026-11-02')],
        months: [{ month: '2026-11', first_visit: 0, first_this_month: 0, exact: true }],
      },
    });
  });
});
