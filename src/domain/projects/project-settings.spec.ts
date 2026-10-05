import { InvalidProjectSettingsError } from '../errors/project.errors';
import {
  MAX_PROJECT_NAME_LENGTH,
  requireConversionEvent,
  requireOrigins,
  requireProjectName,
  requireTimeZone,
} from './project-settings';

function failureOf(action: () => unknown): InvalidProjectSettingsError {
  try {
    action();
  } catch (error) {
    if (error instanceof InvalidProjectSettingsError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected an InvalidProjectSettingsError');
}

describe('requireProjectName', () => {
  it('trims the name', () => {
    expect(requireProjectName('  Shop  ')).toBe('Shop');
  });

  it.each(['', '   ', 'x'.repeat(MAX_PROJECT_NAME_LENGTH + 1)])('refuses %j', (name) => {
    expect(failureOf(() => requireProjectName(name)).field).toBe('name');
  });
});

describe('requireOrigins', () => {
  it('keeps canonical origins once each, in order', () => {
    expect(
      requireOrigins([
        'https://shop.example.com',
        'http://localhost:5173',
        'https://shop.example.com',
      ]),
    ).toEqual(['https://shop.example.com', 'http://localhost:5173']);
  });

  it('accepts an explicit port that is not the default', () => {
    expect(requireOrigins(['https://shop.example.com:8443'])).toEqual([
      'https://shop.example.com:8443',
    ]);
  });

  it('refuses an empty list', () => {
    expect(failureOf(() => requireOrigins([])).field).toBe('origin');
  });

  it.each([
    'https://shop.example.com/',
    'https://shop.example.com/pricing',
    'https://Shop.example.com',
    'https://shop.example.com:443',
    'shop.example.com',
    'ftp://shop.example.com',
    'not a url',
  ])('refuses %j, which no browser sends as an Origin', (origin) => {
    const failure = failureOf(() => requireOrigins([origin]));

    expect(failure.field).toBe('origin');
    expect(failure.message).toContain(origin);
  });
});

describe('requireTimeZone', () => {
  it.each(['America/Sao_Paulo', 'UTC', 'Europe/Lisbon'])('accepts %s', (timezone) => {
    expect(requireTimeZone(timezone)).toBe(timezone);
  });

  it.each(['Mars/Olympus', 'GMT-3:00', ''])('refuses %j', (timezone) => {
    expect(failureOf(() => requireTimeZone(timezone)).field).toBe('timezone');
  });
});

describe('requireConversionEvent', () => {
  it('accepts an event name', () => {
    expect(requireConversionEvent('signup_completed')).toBe('signup_completed');
  });

  it.each(['Signup', 'signup-completed', ''])('refuses %j', (name) => {
    expect(failureOf(() => requireConversionEvent(name)).field).toBe('conversion-event');
  });
});
