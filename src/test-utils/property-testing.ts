import fc from 'fast-check';

export const PROPERTY_SEED = 20_261_028;
export const PROPERTY_RUNS = 300;
export const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };

const PHONE_AND_DOCUMENT_SEPARATORS = ['.', '-', '/', '(', ')', '+', ' '];
const MAX_SEPARATORS_IN_A_ROW = 2;

export function digitRun(minDigits: number, maxDigits: number): fc.Arbitrary<string> {
  const separators = fc.string({
    unit: fc.constantFrom(...PHONE_AND_DOCUMENT_SEPARATORS),
    maxLength: MAX_SEPARATORS_IN_A_ROW,
  });
  const digitAndSeparators = fc
    .tuple(fc.stringMatching(/^\d$/), separators)
    .map(([digit, after]) => `${digit}${after}`);
  return fc
    .tuple(separators, fc.array(digitAndSeparators, { minLength: minDigits, maxLength: maxDigits }))
    .map(([before, digits]) => `${before}${digits.join('')}`);
}

export function shortEmailAddress(maxLength: number): fc.Arbitrary<string> {
  return fc.emailAddress({ size: 'xsmall' }).filter((address) => address.length <= maxLength);
}
