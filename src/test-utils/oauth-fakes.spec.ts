import { InMemoryAuthorizationRequestRepository } from './in-memory-authorization-request.repository';
import { InMemoryOAuthConnectionRepository } from './in-memory-oauth-connection.repository';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const LATER = new Date('2026-10-15T13:00:00.000Z');

describe('InMemoryAuthorizationRequestRepository', () => {
  it('approves a pending request only', async () => {
    const requests = new InMemoryAuthorizationRequestRepository();
    const request = await requests.create({
      clientId: 'client',
      redirectUri: 'https://client.example.com/callback',
      state: null,
      codeChallenge: 'challenge',
      createdAt: NOW,
      expiresAt: LATER,
    });
    const approval = {
      adminUserId: 'admin',
      codeHash: 'hash',
      codeExpiresAt: LATER,
      decidedAt: NOW,
    };

    expect(await requests.approve(request.id, approval)).toEqual(request);
    expect(await requests.approve(request.id, approval)).toBeNull();
    expect(await requests.deny(request.id, NOW)).toBeNull();
  });
});

describe('InMemoryOAuthConnectionRepository', () => {
  it('rotates a refresh token once', async () => {
    const connections = new InMemoryOAuthConnectionRepository();
    await connections.create({ adminUserId: 'admin', clientId: 'client', createdAt: NOW }, [
      { kind: 'refresh', tokenHash: 'refresh-hash', expiresAt: LATER },
    ]);
    const stored = await connections.findRefreshToken('refresh-hash');

    expect(await connections.markRefreshTokenRotated(String(stored?.id), NOW)).toBe(true);
    expect(await connections.markRefreshTokenRotated(String(stored?.id), LATER)).toBe(false);
    expect((await connections.findRefreshToken('refresh-hash'))?.rotatedAt).toEqual(NOW);
  });

  it('revokes every live connection of one admin, and counts them', async () => {
    const connections = new InMemoryOAuthConnectionRepository();
    for (const adminUserId of ['ana', 'ana', 'bruno']) {
      await connections.create({ adminUserId, clientId: 'client', createdAt: NOW }, []);
    }

    expect(await connections.revokeAllOf('ana', LATER)).toBe(2);
    expect(await connections.revokeAllOf('ana', LATER)).toBe(0);
    expect(connections.connections.map(({ revokedAt }) => revokedAt)).toEqual([LATER, LATER, null]);
  });
});
