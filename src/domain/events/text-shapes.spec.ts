import { countDigits, isUuid } from './text-shapes';

describe('isUuid', () => {
  it.each([
    '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
    '9F1C2B3A-1D2E-4F5A-8B6C-7D8E9F0A1B2C',
    '12345678-1234-4234-8234-123456789012',
  ])('recognizes %s', (text) => {
    expect(isUuid(text)).toBe(true);
  });

  it.each(['9f1c2b3a1d2e4f5a8b6c7d8e9f0a1b2c', '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2', 'orders'])(
    'rejects %s',
    (text) => {
      expect(isUuid(text)).toBe(false);
    },
  );
});

describe('countDigits', () => {
  it('counts the digits wherever they are', () => {
    expect(countDigits('(11) 98765-4321')).toBe(11);
  });

  it('is zero for text without digits', () => {
    expect(countDigits('pricing')).toBe(0);
  });
});
