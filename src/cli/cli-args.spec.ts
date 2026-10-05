import {
  CliUsageError,
  flag,
  optionalText,
  parseCommandArgs,
  requiredId,
  requiredText,
  textList,
  usageErrorFrom,
} from './cli-args';

const OPTIONS = {
  name: { type: 'string' },
  origin: { type: 'string', multiple: true },
  clear: { type: 'boolean' },
} as const;

describe('parseCommandArgs', () => {
  it('reads the declared options', () => {
    expect(
      parseCommandArgs(['--name', 'Shop', '--origin', 'a', '--origin', 'b', '--clear'], OPTIONS),
    ).toEqual({ name: 'Shop', origin: ['a', 'b'], clear: true });
  });

  it.each([
    ['an unknown option', ['--nmae', 'Shop']],
    ['a positional argument', ['Shop']],
    ['an option without its value', ['--name']],
  ])('turns %s into a usage error', (_, argv) => {
    expect(() => parseCommandArgs(argv, OPTIONS)).toThrow(CliUsageError);
  });
});

describe('usageErrorFrom', () => {
  it('keeps the message of an error and describes anything else', () => {
    expect(usageErrorFrom(new TypeError('Unknown option')).message).toBe('Unknown option');
    expect(usageErrorFrom('odd failure').message).toBe('odd failure');
  });
});

describe('option readers', () => {
  const values = {
    name: 'Shop',
    blank: '  ',
    origin: ['a', 'b'],
    clear: true,
    id: '9F1C2B3A-1D2E-4F5A-8B6C-7D8E9F0A1B2C',
  };

  it('read an optional text, a list and a flag', () => {
    expect(optionalText(values, 'name')).toBe('Shop');
    expect(optionalText(values, 'missing')).toBeUndefined();
    expect(optionalText(values, 'origin')).toBeUndefined();
    expect(textList(values, 'origin')).toEqual(['a', 'b']);
    expect(textList(values, 'missing')).toEqual([]);
    expect(flag(values, 'clear')).toBe(true);
    expect(flag(values, 'missing')).toBe(false);
  });

  it('require a non-blank text', () => {
    expect(requiredText(values, 'name')).toBe('Shop');
    expect(() => requiredText(values, 'blank')).toThrow('--blank is required.');
    expect(() => requiredText(values, 'missing')).toThrow('--missing is required.');
  });

  it('require a UUID and lower-case it', () => {
    expect(requiredId(values, 'id')).toBe('9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c');
    expect(() => requiredId(values, 'name')).toThrow('--name must be a UUID.');
  });
});
