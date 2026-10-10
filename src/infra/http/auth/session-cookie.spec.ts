import { readSessionToken, SESSION_COOKIE_NAME } from './session-cookie';

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
