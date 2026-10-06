import {
  clearedSessionCookie,
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookie,
} from './session-cookie';

describe('readSessionToken', () => {
  it('finds the session token among other cookies', () => {
    expect(readSessionToken(`theme=dark; ${SESSION_COOKIE_NAME}=abc-123; lang=en`)).toBe('abc-123');
  });

  it('reads nothing when there is no cookie header', () => {
    expect(readSessionToken(undefined)).toBeUndefined();
  });

  it('reads nothing when the session cookie is absent', () => {
    expect(readSessionToken('theme=dark; lang=en')).toBeUndefined();
  });

  it('reads nothing from an empty session cookie', () => {
    expect(readSessionToken(`${SESSION_COOKIE_NAME}=; theme=dark`)).toBeUndefined();
  });

  it('skips pieces without an equals sign', () => {
    expect(readSessionToken(`flag; ${SESSION_COOKIE_NAME}=token`)).toBe('token');
  });

  it('does not mistake a cookie whose name only ends like the session one', () => {
    expect(readSessionToken(`old_${SESSION_COOKIE_NAME}=stale`)).toBeUndefined();
  });
});

describe('sessionCookie', () => {
  it('is HttpOnly, Secure, SameSite=Lax and lives seven days', () => {
    expect(sessionCookie('token', undefined)).toBe(
      'pyxis_session=token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
    );
  });

  it('names the domain when one is configured', () => {
    expect(sessionCookie('token', 'pyxis.example.com')).toBe(
      'pyxis_session=token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800; ' +
        'Domain=pyxis.example.com',
    );
  });
});

describe('clearedSessionCookie', () => {
  it('expires the cookie with the same attributes it was set with', () => {
    expect(clearedSessionCookie('pyxis.example.com')).toBe(
      'pyxis_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Domain=pyxis.example.com',
    );
  });
});
