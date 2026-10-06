import { z } from 'zod';
import { InvalidRequestError } from './errors/http-errors';
import { SchemaPipe } from './schema-pipe';

const pipe = new SchemaPipe(z.strictObject({ email: z.email() }));

describe('SchemaPipe', () => {
  it('hands the parsed value on', () => {
    expect(pipe.transform({ email: 'ada@example.com' })).toEqual({ email: 'ada@example.com' });
  });

  it('rejects a value the schema refuses, without echoing it', () => {
    expect(() => pipe.transform({ email: 'not-an-email', extra: true })).toThrow(
      InvalidRequestError,
    );
  });
});
