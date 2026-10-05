import { looksPersonal } from './pii-barrier';

describe('looksPersonal', () => {
  it.each([
    ['ana@example.com', 'email'],
    ['write to ana@example.com today', 'email'],
    ['(11) 98765-4321', 'long_number'],
    ['+55 11 98765-4321', 'long_number'],
    ['1198765432', 'long_number'],
    ['123.456.789-09', 'long_number'],
    ['12.345.678/0001-95', 'long_number'],
    ['1696600000000', 'long_number'],
  ])('flags %j as %s', (value, reason) => {
    expect(looksPersonal(value)).toBe(reason);
  });

  it.each([
    '12345678-1234-4234-8234-123456789012',
    '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
    '119876543',
    'plan 2026 pro',
    'ifood',
    'black-friday-2026',
    'user@localhost',
    '',
  ])('keeps %j', (value) => {
    expect(looksPersonal(value)).toBeNull();
  });

  it.each([1_000_000_000, -1_000_000_000, 1_696_600_000_000, 12_345_678_901.5])(
    'flags the number %d, whose integer part has ten or more digits',
    (value) => {
      expect(looksPersonal(value)).toBe('long_number');
    },
  );

  it.each([999_999_999, -999_999_999.99, 0, 42.5])('keeps the number %d', (value) => {
    expect(looksPersonal(value)).toBeNull();
  });
});
