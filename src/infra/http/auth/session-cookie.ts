import { SESSION_ABSOLUTE_TTL_MS } from '../../../domain/auth/session-policy';

export const SESSION_COOKIE_NAME = 'pyxis_session';

const MILLISECONDS_PER_SECOND = 1_000;

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator !== -1 && pair.slice(0, separator).trim() === SESSION_COOKIE_NAME) {
      const value = pair.slice(separator + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

function cookieAttributes(domain: string | undefined, maxAgeSeconds: number): string {
  return [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${String(maxAgeSeconds)}`,
    ...(domain === undefined ? [] : [`Domain=${domain}`]),
  ].join('; ');
}

export function sessionCookie(token: string, domain: string | undefined): string {
  const maxAgeSeconds = SESSION_ABSOLUTE_TTL_MS / MILLISECONDS_PER_SECOND;
  return `${SESSION_COOKIE_NAME}=${token}; ${cookieAttributes(domain, maxAgeSeconds)}`;
}

export function clearedSessionCookie(domain: string | undefined): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes(domain, 0)}`;
}
