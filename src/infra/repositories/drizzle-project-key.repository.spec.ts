import { toProjectKey } from './drizzle-project-key.repository';

const BASE = {
  id: 'key-1',
  projectId: 'project-1',
  createdAt: new Date('2026-10-06T00:00:00.000Z'),
  revokedAt: null,
};

describe('toProjectKey', () => {
  it('maps a public row to a public key', () => {
    expect(
      toProjectKey({ ...BASE, kind: 'public', publicKey: 'public-value', secretHash: null }),
    ).toEqual({ ...BASE, kind: 'public', publicKey: 'public-value' });
  });

  it('maps a secret row to a key that only knows its hash', () => {
    expect(
      toProjectKey({ ...BASE, kind: 'secret', publicKey: null, secretHash: 'f'.repeat(64) }),
    ).toEqual({ ...BASE, kind: 'secret', secretHash: 'f'.repeat(64) });
  });

  it.each([
    [
      'a public row without its key',
      { kind: 'public' as const, publicKey: null, secretHash: null },
    ],
    [
      'a secret row without its hash',
      { kind: 'secret' as const, publicKey: null, secretHash: null },
    ],
  ])('refuses %s, which the table check never lets in', (_, row) => {
    expect(() => toProjectKey({ ...BASE, ...row })).toThrow('requires it');
  });
});
