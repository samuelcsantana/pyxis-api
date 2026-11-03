import { DrizzleQueryError } from 'drizzle-orm';
import { describeError } from './describe-error';

const INSERT = 'insert into "events" ("id", "properties") values ($1, $2)';
const SENT_VALUES = ['9f1c2b3a-1d2e-4f5a-8b6c-000000000111', '{"plan":"pro\\u0000"}'];

function failedQuery(cause: unknown): DrizzleQueryError {
  return new DrizzleQueryError(INSERT, SENT_VALUES, cause as Error);
}

describe('describeError', () => {
  it('names a failed database query by the SQLSTATE of its cause, never by its query or values', () => {
    const cause = Object.assign(new Error('unsupported Unicode escape sequence'), {
      code: '22P05',
    });

    const description = describeError(failedQuery(cause));

    expect(description).toBe('database query failed (22P05)');
    expect(description).not.toContain('pro');
    expect(description).not.toContain('insert');
  });

  it('names a failed database query by the code of a connection failure', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });

    expect(describeError(failedQuery(cause))).toBe('database query failed (ECONNREFUSED)');
  });

  it.each([
    ['no cause', undefined],
    ['a cause without a code', new Error('socket hang up')],
    ['a cause whose code is not a string', Object.assign(new Error('odd'), { code: 57014 })],
    ['a cause whose code is free text', Object.assign(new Error('odd'), { code: 'pro plan' })],
  ])('names a failed database query with %s as having no code', (_label, cause) => {
    expect(describeError(failedQuery(cause))).toBe('database query failed (no code)');
  });

  it('keeps the message of any other error', () => {
    expect(describeError(new TypeError('items is not iterable'))).toBe('items is not iterable');
  });

  it('keeps something thrown that is not an Error as text', () => {
    expect(describeError('connection reset')).toBe('connection reset');
  });
});
