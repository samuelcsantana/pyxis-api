import fc from 'fast-check';
import { PROPERTY_PARAMETERS, shortEmailAddress } from '../../test-utils/property-testing';
import { ID_PLACEHOLDER, templatePath } from './path-template';

const MIN_IDENTIFIER_DIGITS = 10;
const MAX_PATH_SEGMENTS = 8;
const MAX_EMAIL_LENGTH = 64;
const ROOT = '/';
const ENCODED_AT_SIGN = '%40';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGIT = /\d/;

function digitCount(segment: string): number {
  return Array.from(segment).filter((character) => DIGIT.test(character)).length;
}

function looksLikeIdentifier(segment: string): boolean {
  const digits = digitCount(segment);
  return (
    UUID_SHAPE.test(segment) ||
    (segment.length > 0 && digits === segment.length) ||
    digits >= MIN_IDENTIFIER_DIGITS ||
    segment.includes('@') ||
    segment.toLowerCase().includes(ENCODED_AT_SIGN)
  );
}

const identifierSegment = fc
  .oneof(
    fc.uuid(),
    fc.stringMatching(/^\d{1,20}$/),
    fc.stringMatching(/^[a-z-]{0,5}\d{10,14}$/),
    shortEmailAddress(MAX_EMAIL_LENGTH),
    shortEmailAddress(MAX_EMAIL_LENGTH).map((address) => address.replaceAll('@', ENCODED_AT_SIGN)),
  )
  .filter((segment) => !segment.includes(ROOT));

const anySegment = fc.oneof(fc.webSegment(), fc.string({ unit: 'binary' }), identifierSegment);

function pathOf(segment: fc.Arbitrary<string>): fc.Arbitrary<string> {
  return fc
    .array(segment, { maxLength: MAX_PATH_SEGMENTS })
    .map((segments) => `${ROOT}${segments.join(ROOT)}`);
}

const anyPath = fc.oneof(pathOf(anySegment), fc.webPath(), fc.string({ unit: 'binary' }));

const pathWithoutIdentifiers = pathOf(
  fc.webSegment().filter((segment) => segment !== '' && !looksLikeIdentifier(segment)),
);

describe('templatePath, for any path', () => {
  it('leaves no segment shaped like an identifier', () => {
    fc.assert(
      fc.property(anyPath, (path) => {
        const survivors = templatePath(path)
          .split(ROOT)
          .filter((segment) => segment !== ID_PLACEHOLDER && looksLikeIdentifier(segment));

        expect(survivors).toEqual([]);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('changes nothing when applied a second time', () => {
    fc.assert(
      fc.property(anyPath, (path) => {
        const once = templatePath(path);

        expect(templatePath(once)).toBe(once);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('never answers an empty path or one ending in a slash, other than the root', () => {
    fc.assert(
      fc.property(anyPath, (path) => {
        const templated = templatePath(path);

        expect(templated === ROOT || (templated !== '' && !templated.endsWith(ROOT))).toBe(true);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps a path with no identifier in it as it was', () => {
    fc.assert(
      fc.property(pathWithoutIdentifiers, (path) => {
        expect(templatePath(path)).toBe(path);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('replaces each identifier-shaped segment with the placeholder, wherever it sits', () => {
    fc.assert(
      fc.property(
        pathWithoutIdentifiers,
        identifierSegment,
        pathWithoutIdentifiers,
        (before, identifier, after) => {
          const prefix = before === ROOT ? '' : before;

          expect(templatePath(`${prefix}/${identifier}${after}`)).toBe(
            `${prefix}/${ID_PLACEHOLDER}${after === ROOT ? '' : after}`,
          );
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });
});
