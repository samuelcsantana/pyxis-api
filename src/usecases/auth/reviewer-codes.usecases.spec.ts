import { sha256Hex } from '../../domain/auth/hashing';
import { AdminNotFoundError } from '../../domain/errors/auth.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryReviewerCodeRepository } from '../../test-utils/in-memory-reviewer-code.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CloseReviewerCodeUseCase } from './close-reviewer-code.usecase';
import { OpenReviewerCodeUseCase } from './open-reviewer-code.usecase';

const REVIEWER_EMAIL = 'reviewer@example.com';
const NOW = new Date('2026-10-20T12:00:00.000Z');

async function setup() {
  const admins = new InMemoryAdminUserRepository();
  const reviewer = await admins.findOrCreateByEmail(REVIEWER_EMAIL);
  const codes = new InMemoryReviewerCodeRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource([4, 2, 4, 2, 4, 2]);
  return {
    reviewer,
    codes,
    open: new OpenReviewerCodeUseCase(admins, codes, clock, random),
    close: new CloseReviewerCodeUseCase(admins, codes),
  };
}

describe('opening a reviewer code', () => {
  it('gives the code once and keeps only its hash, until the days asked for', async () => {
    const { open, codes, reviewer } = await setup();

    const opened = await open.execute({ email: ' Reviewer@Example.com ', days: 30 });

    expect(opened).toEqual({
      adminUserId: reviewer.id,
      email: REVIEWER_EMAIL,
      code: '424242',
      expiresAt: new Date('2026-11-19T12:00:00.000Z'),
    });
    expect(codes.stored.get(reviewer.id)).toEqual({
      adminUserId: reviewer.id,
      codeHash: sha256Hex('424242'),
      failedAttempts: 0,
      createdAt: NOW,
      expiresAt: new Date('2026-11-19T12:00:00.000Z'),
    });
  });

  it('replaces the code the admin had, with its failed attempts', async () => {
    const { open, codes, reviewer } = await setup();
    await open.execute({ email: REVIEWER_EMAIL, days: 30 });
    await codes.reserveAttempt(reviewer.id, NOW, 20);

    await open.execute({ email: REVIEWER_EMAIL, days: 365 });

    expect(codes.stored.get(reviewer.id)).toMatchObject({
      failedAttempts: 0,
      expiresAt: new Date('2027-10-20T12:00:00.000Z'),
    });
  });

  it('refuses an address that is no admin', async () => {
    const { open } = await setup();

    await expect(open.execute({ email: 'stranger@example.com', days: 30 })).rejects.toBeInstanceOf(
      AdminNotFoundError,
    );
  });
});

describe('closing a reviewer code', () => {
  it('says whether a code was open', async () => {
    const { open, close, reviewer } = await setup();
    await open.execute({ email: REVIEWER_EMAIL, days: 30 });

    expect(await close.execute({ email: REVIEWER_EMAIL })).toEqual({
      adminUserId: reviewer.id,
      email: REVIEWER_EMAIL,
      closed: true,
    });
    expect((await close.execute({ email: REVIEWER_EMAIL })).closed).toBe(false);
  });

  it('refuses an address that is no admin', async () => {
    const { close } = await setup();

    await expect(close.execute({ email: 'stranger@example.com' })).rejects.toBeInstanceOf(
      AdminNotFoundError,
    );
  });
});
