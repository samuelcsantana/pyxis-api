import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { decodeHeaderName } from './header-name';

const MAX_LENGTH = 40;
const CONTROL_CHARACTER = /\p{Cc}/u;
const MAX_GENERATED_BYTES = 60;

function isAcceptable(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_LENGTH &&
    name.trim() === name &&
    !CONTROL_CHARACTER.test(name)
  );
}

const acceptableName = fc
  .string({ unit: 'grapheme', minLength: 1, maxLength: MAX_LENGTH })
  .filter(isAcceptable);

const percentEncodedBytes = fc
  .uint8Array({ maxLength: MAX_GENERATED_BYTES })
  .map((bytes) =>
    Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0').toUpperCase()}`).join(''),
  );

describe('decodeHeaderName, for any header value', () => {
  it('gives back any acceptable name percent-encoded the way CloudFront sends it', () => {
    fc.assert(
      fc.property(acceptableName, (name) => {
        expect(decodeHeaderName(encodeURIComponent(name), MAX_LENGTH)).toBe(name);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('answers null or a trimmed, bounded name without control characters', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary' }), percentEncodedBytes), (encoded) => {
        const name = decodeHeaderName(encoded, MAX_LENGTH);

        expect(name === null || isAcceptable(name)).toBe(true);
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
