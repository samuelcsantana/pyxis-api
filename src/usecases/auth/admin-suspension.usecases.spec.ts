import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccessTokenRepository } from '../../test-utils/in-memory-access-token.repository';
import { InMemoryAdminSessionRepository } from '../../test-utils/in-memory-admin-session.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { ResumeAdminUseCase } from './resume-admin.usecase';
import { SuspendAdminUseCase } from './suspend-admin.usecase';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const LATER = new Date('2026-11-04T09:00:00.000Z');
const EXPIRES_AT = new Date('2026-12-03T12:00:00.000Z');

async function setup() {
  const admins = new InMemoryAdminUserRepository();
  const sessions = new InMemoryAdminSessionRepository();
  const tokens = new InMemoryAccessTokenRepository();
  const clock = new FixedClock(NOW);
  const ana = await admins.findOrCreateByEmail('ana@example.com');
  const bruno = await admins.findOrCreateByEmail('bruno@example.com');
  for (const [admin, hash] of [
    [ana, 'a'],
    [ana, 'b'],
    [bruno, 'c'],
  ] as const) {
    await sessions.create({ adminUserId: admin.id, tokenHash: hash.repeat(64), createdAt: NOW });
    await tokens.create({
      adminUserId: admin.id,
      name: 'Agent',
      tokenHash: hash.repeat(64),
      createdAt: NOW,
      expiresAt: EXPIRES_AT,
    });
  }
  return {
    admins,
    sessions,
    tokens,
    clock,
    ana,
    suspend: new SuspendAdminUseCase(admins, admins, sessions, tokens, clock),
    resume: new ResumeAdminUseCase(admins, admins),
  };
}

describe('SuspendAdminUseCase', () => {
  it("marks the person suspended and ends their sessions and tokens, nobody else's", async () => {
    const { suspend, sessions, tokens, ana } = await setup();

    const suspended = await suspend.execute({ email: ' Ana@Example.com ' });

    expect(suspended).toEqual({
      adminUserId: ana.id,
      email: 'ana@example.com',
      suspendedAt: NOW,
      sessionsEnded: 2,
      tokensRevoked: 2,
    });
    expect(sessions.stored.map(({ revokedAt }) => revokedAt)).toEqual([NOW, NOW, null]);
    expect(tokens.stored.map(({ revokedAt }) => revokedAt)).toEqual([NOW, NOW, null]);
  });

  it('keeps the moment of the first suspension when run again', async () => {
    const { suspend, clock } = await setup();
    await suspend.execute({ email: 'ana@example.com' });
    clock.advanceBy(LATER.getTime() - NOW.getTime());

    const again = await suspend.execute({ email: 'ana@example.com' });

    expect(again).toMatchObject({ suspendedAt: NOW, sessionsEnded: 0, tokensRevoked: 0 });
  });

  it('answers not found for an address that is no admin, or one gone in between', async () => {
    const { suspend, admins, sessions, tokens, clock } = await setup();
    const vanishing = new SuspendAdminUseCase(
      admins,
      { suspend: () => Promise.resolve(null), resume: () => Promise.resolve(null) },
      sessions,
      tokens,
      clock,
    );

    await expect(suspend.execute({ email: 'nobody@example.com' })).rejects.toBeInstanceOf(
      AdminNotFoundError,
    );
    await expect(vanishing.execute({ email: 'ana@example.com' })).rejects.toBeInstanceOf(
      AdminNotFoundError,
    );
  });
});

describe('ResumeAdminUseCase', () => {
  it('lifts the suspension, leaving the ended sessions and tokens ended', async () => {
    const { suspend, resume, sessions } = await setup();
    await suspend.execute({ email: 'ana@example.com' });

    const resumed = await resume.execute({ email: 'ana@example.com' });

    expect(resumed.suspendedAt).toBeNull();
    expect(sessions.stored.filter(({ revokedAt }) => revokedAt !== null)).toHaveLength(2);
  });

  it('answers not found for an address that is no admin', async () => {
    const { resume } = await setup();

    await expect(resume.execute({ email: 'nobody@example.com' })).rejects.toBeInstanceOf(
      AdminNotFoundError,
    );
  });
});
