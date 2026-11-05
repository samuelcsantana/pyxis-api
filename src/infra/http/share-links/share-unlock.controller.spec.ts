import type { UnlockShareLinkUseCase } from '../../../usecases/share-links/unlock-share-link.usecase';
import { ShareUnlockController } from './share-unlock.controller';
import { shareUnlockSchema, unlockShareLinkSchema } from './share-links.schemas';

const TOKEN = `pyxis_sh_${'A'.repeat(32)}`;
const UNLOCK = `pyxis_su_${'U'.repeat(32)}`;

describe('ShareUnlockController', () => {
  it('trades the password of the link in the path for an unlock and its expiry', async () => {
    const asked: unknown[][] = [];
    const controller = new ShareUnlockController({
      execute: (...args: unknown[]) => {
        asked.push(args);
        return Promise.resolve({ unlock: UNLOCK, expiresAt: new Date('2026-11-05T20:00:00.000Z') });
      },
    } as unknown as UnlockShareLinkUseCase);

    const body = await controller.unlock(
      TOKEN,
      unlockShareLinkSchema.parse({ password: ' correct horse ' }),
    );

    expect(shareUnlockSchema.parse(body)).toEqual({
      unlock: UNLOCK,
      expires_at: '2026-11-05T20:00:00.000Z',
    });
    expect(asked).toEqual([[TOKEN, ' correct horse ']]);
  });

  it.each([
    ['no password', {}],
    ['an unknown field', { password: 'correct horse', remember: true }],
  ])('refuses a body with %s at the edge', (_case, body) => {
    expect(unlockShareLinkSchema.safeParse(body).success).toBe(false);
  });
});
