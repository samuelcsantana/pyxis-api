import fc from 'fast-check';
import {
  digitRun,
  PROPERTY_PARAMETERS,
  shortEmailAddress,
} from '../../test-utils/property-testing';
import { looksPersonal } from './pii-barrier';

const MIN_PERSONAL_DIGITS = 10;
const MAX_DOCUMENT_DIGITS = 20;
const ANY_EMAIL_LENGTH = 254;

function integerDigitCount(value: number): number {
  const integerPart = BigInt(Math.trunc(value));
  return (integerPart < 0n ? -integerPart : integerPart).toString().length;
}

describe('looksPersonal, for any input', () => {
  it('flags as an email any text with an email address in it', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary' }),
        shortEmailAddress(ANY_EMAIL_LENGTH),
        fc.string({ unit: 'binary' }),
        (before, address, after) => {
          expect(looksPersonal(`${before}${address}${after}`)).toBe('email');
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('flags as a long number ten or more digits written only with phone or document separators', () => {
    fc.assert(
      fc.property(digitRun(MIN_PERSONAL_DIGITS, MAX_DOCUMENT_DIGITS), (text) => {
        expect(looksPersonal(text)).toBe('long_number');
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps fewer than ten digits written only with phone or document separators', () => {
    fc.assert(
      fc.property(digitRun(0, MIN_PERSONAL_DIGITS - 1), (text) => {
        expect(looksPersonal(text)).toBeNull();
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps every UUID, whatever its digits', () => {
    fc.assert(
      fc.property(fc.uuid(), (uuid) => {
        expect(looksPersonal(uuid)).toBeNull();
        expect(looksPersonal(uuid.toUpperCase())).toBeNull();
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('flags a number exactly when its integer part has ten or more digits', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.maxSafeInteger(), fc.double({ noNaN: true, noDefaultInfinity: true })),
        (value) => {
          const expected = integerDigitCount(value) >= MIN_PERSONAL_DIGITS ? 'long_number' : null;

          expect(looksPersonal(value)).toBe(expected);
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });
});
