import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const OWNER_ID = '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a01';
const ACCOUNT_ID = '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a11';
const SHOP_ID = '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a21';
const OWNER_EMAIL = 'people-owner@example.com';
const OWNER_SESSION = 'e2e-people-owner-session';
const GUEST_SESSION = 'e2e-people-guest-session';

interface Call {
  readonly session?: string | null;
  readonly origin?: string | null;
  readonly payload?: object;
}

describe('the people of a project', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, options: Call = {}) => {
    const session = options.session === undefined ? OWNER_SESSION : options.session;
    const origin = options.origin === undefined ? E2E_DASHBOARD_ORIGIN : options.origin;
    return app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: {
        ...(session === null ? {} : { cookie: `${SESSION_COOKIE_NAME}=${session}` }),
        ...(origin === null ? {} : { origin }),
      },
    });
  };
  const people = `/v1/projects/${SHOP_ID}/people`;

  const removeGuests = async () => {
    await owner`
      DELETE FROM admin_users
      WHERE email IN ('people-guest@example.com', 'people-second@example.com',
                      'people-third@example.com')
    `;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, ${OWNER_EMAIL})`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'People shop', ${ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id, created_at)
      VALUES (${OWNER_ID}, ${SHOP_ID}, '2026-10-01T00:00:00Z')
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(OWNER_SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(MAIL_SENDER)
        .useValue(mail),
    );
  });

  beforeEach(async () => {
    mail.invitations.length = 0;
    await removeGuests();
  });

  afterAll(async () => {
    await app.close();
    await removeGuests();
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('adds a person, e-mails the invitation and lists them for everyone on the project', async () => {
    const added = await call('POST', people, {
      payload: { email: 'People-Guest@example.com', locale: 'pt-BR' },
    });
    const guestId = added.json<{ person: { admin_user_id: string } }>().person.admin_user_id;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${guestId}, ${sha256Hex(GUEST_SESSION)}, ${NOW}, ${NOW})
    `;

    const asGuest = await call('GET', people, { session: GUEST_SESSION });

    expect(added.statusCode).toBe(200);
    expect(added.json()).toMatchObject({
      added: true,
      person: { email: 'people-guest@example.com', role: 'member' },
    });
    expect(mail.invitations).toEqual([
      {
        email: 'people-guest@example.com',
        invitation: { projectName: 'People shop', inviterEmail: OWNER_EMAIL },
        language: 'pt-BR',
      },
    ]);
    expect(asGuest.statusCode).toBe(200);
    expect(asGuest.json()).toEqual({
      people: [
        expect.objectContaining({ email: OWNER_EMAIL, role: 'owner' }),
        expect.objectContaining({ email: 'people-guest@example.com', role: 'member' }),
      ],
    });
  });

  it('lets only the owner add and remove, and the owner stays', async () => {
    const added = await call('POST', people, { payload: { email: 'people-guest@example.com' } });
    const guestId = added.json<{ person: { admin_user_id: string } }>().person.admin_user_id;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${guestId}, ${sha256Hex(GUEST_SESSION)}, ${NOW}, ${NOW})
    `;

    const guestAdds = await call('POST', people, {
      session: GUEST_SESSION,
      payload: { email: 'people-second@example.com' },
    });
    const ownerRemoved = await call('DELETE', `${people}/${OWNER_ID}`);
    const removed = await call('DELETE', `${people}/${guestId}`);
    const gone = await call('DELETE', `${people}/${guestId}`);

    expect(guestAdds.statusCode).toBe(404);
    expect(ownerRemoved.statusCode).toBe(409);
    expect(ownerRemoved.json()).toMatchObject({ error: 'owner_stays' });
    expect(removed.statusCode).toBe(204);
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toMatchObject({ error: 'person_not_found' });
    expect((await call('GET', people, { session: GUEST_SESSION })).statusCode).toBe(404);
  });

  it("stops at the plan's three people, the owner included", async () => {
    await call('POST', people, { payload: { email: 'people-guest@example.com' } });
    await call('POST', people, { payload: { email: 'people-second@example.com' } });

    const third = await call('POST', people, { payload: { email: 'people-third@example.com' } });

    expect(third.statusCode).toBe(409);
    expect(third.json()).toMatchObject({ error: 'people_limit_reached' });
    expect(mail.invitations).toHaveLength(2);
  });

  it('needs the dashboard and a session to add, and a valid address', async () => {
    const elsewhere = await call('POST', people, {
      origin: 'https://evil.example.com',
      payload: { email: 'people-guest@example.com' },
    });
    const anonymous = await call('POST', people, {
      session: null,
      payload: { email: 'people-guest@example.com' },
    });
    const invalid = await call('POST', people, { payload: { email: 'not an address' } });

    expect(elsewhere.statusCode).toBe(403);
    expect(anonymous.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(400);
    expect(mail.invitations).toEqual([]);
  });
});
