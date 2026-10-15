import type postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleAuthorizationRequestRepository } from '../../src/infra/repositories/drizzle-authorization-request.repository';
import { DrizzleOAuthConnectionRepository } from '../../src/infra/repositories/drizzle-oauth-connection.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c5f3e4d6-7d8a-4192-a314-c5d6e7f8091b';
const CLIENT_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const NOW = new Date('2026-10-15T12:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe('OAuth repositories against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let requests: DrizzleAuthorizationRequestRepository;
  let connections: DrizzleOAuthConnectionRepository;
  let anaId: string;
  let brunoId: string;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    requests = new DrizzleAuthorizationRequestRepository(db);
    connections = new DrizzleOAuthConnectionRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop')`;
    const admins = new DrizzleAdminUserRepository(createDrizzleDatabase(app));
    anaId = (await admins.grantAccess('ana@example.com', SHOP_ID)).id;
    brunoId = (await admins.grantAccess('bruno@example.com', SHOP_ID)).id;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  function startRequest(state: string | null = 'state') {
    return requests.create({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state,
      codeChallenge: CHALLENGE,
      createdAt: NOW,
      expiresAt: at(10 * MINUTE),
    });
  }

  function approval(code: string, decidedAt = NOW) {
    return {
      adminUserId: anaId,
      codeHash: sha256Hex(code),
      codeExpiresAt: at(5 * MINUTE),
      decidedAt,
    };
  }

  function pair(name: string, issuedAt = NOW) {
    return [
      {
        kind: 'access' as const,
        tokenHash: sha256Hex(`${name}-access`),
        expiresAt: new Date(issuedAt.getTime() + HOUR),
      },
      {
        kind: 'refresh' as const,
        tokenHash: sha256Hex(`${name}-refresh`),
        expiresAt: new Date(issuedAt.getTime() + 90 * 24 * HOUR),
      },
    ];
  }

  function connect(adminUserId: string, name: string, createdAt = NOW) {
    return connections.create(
      { adminUserId, clientId: CLIENT_ID, createdAt },
      pair(name, createdAt),
    );
  }

  it('keeps a request pending until it is answered once or expires', async () => {
    const request = await startRequest();
    const denied = await startRequest(null);

    expect(request).toEqual({
      id: expect.any(String) as string,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: 'state',
      codeChallenge: CHALLENGE,
      createdAt: NOW,
      expiresAt: at(10 * MINUTE),
    });
    expect(await requests.findPending(request.id, NOW)).toEqual(request);
    expect(await requests.findPending(request.id, at(10 * MINUTE))).toBeNull();
    expect(await requests.approve(request.id, approval('late', at(10 * MINUTE)))).toBeNull();
    expect(await requests.approve(request.id, approval('code'))).toEqual(request);
    expect(await requests.approve(request.id, approval('again'))).toBeNull();
    expect(await requests.findPending(request.id, NOW)).toBeNull();
    expect(await requests.deny(denied.id, NOW)).toMatchObject({ id: denied.id, state: null });
    expect(await requests.deny(denied.id, NOW)).toBeNull();
    const [row] = await owner<{ decision: string; admin_user_id: string | null }[]>`
      SELECT decision, admin_user_id FROM oauth_authorization_requests WHERE id = ${denied.id}
    `;
    expect(row).toEqual({ decision: 'denied', admin_user_id: null });
  });

  it('redeems a code once within five minutes and remembers what it became', async () => {
    const request = await startRequest();
    const expiring = await startRequest();
    await requests.approve(request.id, approval('code'));
    await requests.approve(expiring.id, approval('expiring'));

    expect(await requests.findSpentCode(sha256Hex('code'))).toBeNull();
    expect(await requests.redeemCode(sha256Hex('expiring'), at(5 * MINUTE))).toBeNull();
    expect(await requests.redeemCode(sha256Hex('code'), at(MINUTE))).toEqual({
      request,
      adminUserId: anaId,
    });
    expect(await requests.redeemCode(sha256Hex('code'), at(MINUTE))).toBeNull();
    expect(await requests.findSpentCode(sha256Hex('code'))).toEqual({ connectionId: null });

    const connection = await connect(anaId, 'from-code');
    await requests.linkConnection(request.id, connection.id);
    expect(await requests.findSpentCode(sha256Hex('code'))).toEqual({
      connectionId: connection.id,
    });
  });

  it('creates a connection with its tokens and finds it by a live access token only', async () => {
    const connection = await connect(anaId, 'first');

    expect(connection).toEqual({
      id: expect.any(String) as string,
      adminUserId: anaId,
      clientId: CLIENT_ID,
      createdAt: NOW,
      lastUsedAt: NOW,
    });
    expect(await connections.findLive(connection.id)).toEqual(connection);
    expect(await connections.findLiveByAccessToken(sha256Hex('first-access'), NOW)).toEqual(
      connection,
    );
    expect(await connections.findLiveByAccessToken(sha256Hex('first-access'), at(HOUR))).toBeNull();
    expect(await connections.findLiveByAccessToken(sha256Hex('first-refresh'), NOW)).toBeNull();
    expect(await connections.findLiveByAnyToken(sha256Hex('first-refresh'))).toEqual(connection);
    expect(await connections.findLiveByAnyToken(sha256Hex('unknown'))).toBeNull();
  });

  it('rotates a refresh token once and adds the next pair to the same connection', async () => {
    const connection = await connect(anaId, 'first');
    const stored = await connections.findRefreshToken(sha256Hex('first-refresh'));

    expect(stored).toEqual({
      id: expect.any(String) as string,
      connectionId: connection.id,
      expiresAt: at(90 * 24 * HOUR),
      rotatedAt: null,
    });
    expect(await connections.findRefreshToken(sha256Hex('first-access'))).toBeNull();
    expect(await connections.markRefreshTokenRotated(String(stored?.id), at(HOUR))).toBe(true);
    expect(await connections.markRefreshTokenRotated(String(stored?.id), at(2 * HOUR))).toBe(false);
    expect((await connections.findRefreshToken(sha256Hex('first-refresh')))?.rotatedAt).toEqual(
      at(HOUR),
    );

    await connections.issueTokens(connection.id, at(HOUR), pair('second', at(HOUR)));
    await connections.touch(connection.id, at(HOUR));
    expect(await connections.findLiveByAccessToken(sha256Hex('second-access'), at(HOUR))).toEqual({
      ...connection,
      lastUsedAt: at(HOUR),
    });
  });

  it('lists the live connections of an admin, newest first, leaving out idle and revoked ones', async () => {
    const older = await connect(anaId, 'older');
    const newer = await connect(anaId, 'newer', at(MINUTE));
    const idle = await connect(anaId, 'idle', at(2 * MINUTE));
    const revoked = await connect(anaId, 'revoked', at(3 * MINUTE));
    await connect(brunoId, 'bruno');
    await connections.touch(idle.id, at(-HOUR));
    await connections.revoke(revoked.id, NOW);

    const listed = await connections.listLiveOf(anaId, at(-1));

    expect(listed.map((connection) => connection.id)).toEqual([newer.id, older.id]);
  });

  it('revokes one connection of its admin, all of an admin, and none twice', async () => {
    const first = await connect(anaId, 'first');
    await connect(anaId, 'second');
    const bruno = await connect(brunoId, 'bruno');

    expect(await connections.revokeOneOf(brunoId, first.id, NOW)).toBe(false);
    expect(await connections.revokeOneOf(anaId, first.id, NOW)).toBe(true);
    expect(await connections.revokeOneOf(anaId, first.id, NOW)).toBe(false);
    expect(await connections.revokeAllOf(anaId, NOW)).toBe(1);
    expect(await connections.revoke(bruno.id, NOW)).toBe(true);
    expect(await connections.revoke(bruno.id, NOW)).toBe(false);
    expect(await connections.findLive(first.id)).toBeNull();
    expect(await connections.findLiveByAnyToken(sha256Hex('second-access'))).toBeNull();
    expect(await connections.listLiveOf(anaId, at(-HOUR))).toEqual([]);
  });

  it('removes the connections, their tokens and the decided requests with the admin', async () => {
    const request = await startRequest();
    await requests.approve(request.id, approval('code'));
    await connect(anaId, 'first');

    await owner`DELETE FROM admin_users WHERE id = ${anaId}`;

    const [counts] = await owner<{ connections: number; tokens: number; requests: number }[]>`
      SELECT (SELECT count(*)::int FROM oauth_connections) AS connections,
             (SELECT count(*)::int FROM oauth_connection_tokens) AS tokens,
             (SELECT count(*)::int FROM oauth_authorization_requests) AS requests
    `;
    expect(counts).toEqual({ connections: 0, tokens: 0, requests: 0 });
  });
});
