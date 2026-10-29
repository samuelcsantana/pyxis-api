import fc from 'fast-check';
import { z } from 'zod';

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

const LOCAL_PART_UNITS = ['a', 'b', 'Z', '0', '9', '.', '+', '-', '_'];
const MAX_GENERATED_LOCAL_PART = 24;
const MAILBOX_DOMAINS = ['gmail.com', 'GMail.com', 'googlemail.com', 'example.com'];
const ACCEPTED_EMAIL = z.email();

export function signUpEmailAddress(maxLength: number): fc.Arbitrary<string> {
  const localPart = fc.string({
    unit: fc.constantFrom(...LOCAL_PART_UNITS),
    minLength: 1,
    maxLength: MAX_GENERATED_LOCAL_PART,
  });
  const domain = fc.oneof(fc.constantFrom(...MAILBOX_DOMAINS), fc.domain());
  return fc
    .tuple(localPart, domain)
    .map(([local, host]) => `${local}@${host}`)
    .filter((address) => address.length <= maxLength && ACCEPTED_EMAIL.safeParse(address).success);
}
