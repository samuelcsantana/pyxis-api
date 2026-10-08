import type { AdminSession } from '../entities/admin-session.entity';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { normalizeEmail } from './email';
import { resolveEmailLanguage } from './email-language';
import { sha256Hex } from './hashing';
import {
  isSessionActive,
  needsTouch,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_TOKEN_BYTES,
  SESSION_TOUCH_INTERVAL_MS,
  generateSessionToken,
} from './session-policy';
import { generateSignInCode, SIGN_IN_CODE_LENGTH } from './sign-in-code';

const CREATED_AT = new Date('2026-10-06T12:00:00.000Z');

function session(lastUsedAt: Date = CREATED_AT): AdminSession {
  return { id: 'session-1', adminUserId: 'admin-1', createdAt: CREATED_AT, lastUsedAt };
}

function at(offsetMs: number): Date {
  return new Date(CREATED_AT.getTime() + offsetMs);
}

describe('normalizeEmail', () => {
  it('trims and lower-cases the address', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });
});

describe('resolveEmailLanguage', () => {
  it('writes in English when no language is asked for', () => {
    expect(resolveEmailLanguage(undefined)).toBe('en');
  });

  it('matches a supported language whatever its case', () => {
    expect(resolveEmailLanguage('pt-BR')).toBe('pt-BR');
    expect(resolveEmailLanguage('PT-br')).toBe('pt-BR');
    expect(resolveEmailLanguage('en')).toBe('en');
  });

  it('matches on the language alone when the region differs', () => {
    expect(resolveEmailLanguage('pt-PT')).toBe('pt-BR');
    expect(resolveEmailLanguage('pt')).toBe('pt-BR');
    expect(resolveEmailLanguage('en-GB')).toBe('en');
  });

  it('falls back to English for a language it has no email for', () => {
    expect(resolveEmailLanguage('es')).toBe('en');
    expect(resolveEmailLanguage('es-419')).toBe('en');
  });
});

describe('sha256Hex', () => {
  it('hashes to 64 lower-case hex characters', () => {
    expect(sha256Hex('123456')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('123456')).not.toBe(sha256Hex('123457'));
  });
});

describe('generateSignInCode', () => {
  it(`draws ${String(SIGN_IN_CODE_LENGTH)} digits from the random source`, () => {
    expect(generateSignInCode(new SequenceRandomSource([1, 2, 3, 4, 5, 6]))).toBe('123456');
  });

  it('skips the bytes that would bias the digits and asks for more', () => {
    const random = new SequenceRandomSource([250, 255, 7]);
    const bytesSpy = jest.spyOn(random, 'bytes');

    expect(generateSignInCode(random)).toBe('777777');
    expect(bytesSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps leading zeros', () => {
    expect(generateSignInCode(new SequenceRandomSource([0, 10, 20, 30, 40, 9]))).toBe('000009');
  });
});

describe('generateSessionToken', () => {
  it('encodes 32 random bytes as base64url', () => {
    const token = generateSessionToken(new SequenceRandomSource([251, 255, 0]));

    expect(Buffer.from(token, 'base64url')).toHaveLength(SESSION_TOKEN_BYTES);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('isSessionActive', () => {
  it('keeps a session used within a day and younger than a week', () => {
    expect(
      isSessionActive(
        session(at(SESSION_ABSOLUTE_TTL_MS - 60_000)),
        at(SESSION_ABSOLUTE_TTL_MS - 1),
      ),
    ).toBe(true);
  });

  it('ends a session idle for a day', () => {
    expect(isSessionActive(session(), at(SESSION_IDLE_TTL_MS - 1))).toBe(true);
    expect(isSessionActive(session(), at(SESSION_IDLE_TTL_MS))).toBe(false);
  });

  it('ends a session a week after it started, however active', () => {
    expect(
      isSessionActive(session(at(SESSION_ABSOLUTE_TTL_MS - 1)), at(SESSION_ABSOLUTE_TTL_MS)),
    ).toBe(false);
  });
});

describe('needsTouch', () => {
  it('touches a session at most every five minutes', () => {
    expect(needsTouch(session(), at(SESSION_TOUCH_INTERVAL_MS - 1))).toBe(false);
    expect(needsTouch(session(), at(SESSION_TOUCH_INTERVAL_MS))).toBe(true);
  });
});
