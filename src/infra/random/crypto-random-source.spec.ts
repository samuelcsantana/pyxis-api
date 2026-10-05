import { CryptoRandomSource } from './crypto-random-source';

describe('CryptoRandomSource', () => {
  it('returns as many bytes as asked, different on every call', () => {
    const random = new CryptoRandomSource();

    const first = random.bytes(32);
    const second = random.bytes(32);

    expect(first).toHaveLength(32);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });
});
