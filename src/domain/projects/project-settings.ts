import { InvalidProjectSettingsError } from '../errors/project.errors';
import { EVENT_NAME_PATTERN } from '../events/event-limits';

export const MAX_PROJECT_NAME_LENGTH = 100;
export const DEFAULT_TIMEZONE = 'UTC';

const WEB_PROTOCOLS = new Set(['http:', 'https:']);

export function requireProjectName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    throw new InvalidProjectSettingsError(
      'name',
      `The name must have 1 to ${String(MAX_PROJECT_NAME_LENGTH)} characters.`,
    );
  }
  return trimmed;
}

function canonicalOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    return WEB_PROTOCOLS.has(url.protocol) && url.origin === input ? url.origin : null;
  } catch {
    return null;
  }
}

export function requireOrigins(origins: readonly string[]): readonly string[] {
  if (origins.length === 0) {
    throw new InvalidProjectSettingsError('origin', 'Give at least one allowed origin.');
  }
  for (const origin of origins) {
    if (canonicalOrigin(origin) === null) {
      throw new InvalidProjectSettingsError(
        'origin',
        `"${origin}" is not an origin: write scheme, host and port only, as the browser sends ` +
          'it in the Origin header (https://shop.example.com, http://localhost:5173).',
      );
    }
  }
  return [...new Set(origins)];
}

export function requireTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    throw new InvalidProjectSettingsError(
      'timezone',
      `"${timezone}" is not an IANA time zone (America/Sao_Paulo, UTC).`,
    );
  }
}

export function requireConversionEvent(name: string): string {
  if (!EVENT_NAME_PATTERN.test(name)) {
    throw new InvalidProjectSettingsError(
      'conversion-event',
      `"${name}" is not an event name: lower-case letters, digits and underscores, up to 64.`,
    );
  }
  return name;
}
