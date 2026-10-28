import fc from 'fast-check';
import { readCsvRecord } from '../../test-utils/csv-reader';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { csvField, EVENT_CSV_HEADER, eventCsvLine } from './event-csv';
import type { ExportedEvent } from './exported-event';

const RECORD_END = '\r\n';
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];
const FORMULA_GUARD = "'";
const CSV_SPECIAL_PIECES = ['"', ',', '\r', '\n', '\r\n', ' ', 'a', ...FORMULA_TRIGGERS];
const FIRST_OCCURRED_AT = new Date('2000-01-01T00:00:00.000Z');
const LAST_OCCURRED_AT = new Date('2099-12-31T23:59:59.999Z');

function guarded(value: string): string {
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger))
    ? `${FORMULA_GUARD}${value}`
    : value;
}

function readField(value: string | null): string {
  const [field, ...rest] = readCsvRecord(`${csvField(value)}${RECORD_END}`);
  expect(rest).toEqual([]);
  return field ?? '';
}

const text = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc
    .tuple(fc.constantFrom(...FORMULA_TRIGGERS), fc.string({ unit: 'binary' }))
    .map(([trigger, rest]) => `${trigger}${rest}`),
  fc.array(fc.constantFrom(...CSV_SPECIAL_PIECES)).map((pieces) => pieces.join('')),
);

const optionalText = fc.option(text, { nil: null });

const exportedEvent: fc.Arbitrary<ExportedEvent> = fc.record({
  id: text,
  occurredAt: fc.date({ min: FIRST_OCCURRED_AT, max: LAST_OCCURRED_AT, noInvalidDate: true }),
  name: text,
  path: text,
  sessionId: text,
  userId: optionalText,
  referrerHost: optionalText,
  utmSource: optionalText,
  utmMedium: optionalText,
  utmCampaign: optionalText,
  fromAdClick: fc.boolean(),
  channel: optionalText,
  deviceType: text,
  browser: text,
  os: text,
  country: optionalText,
  region: optionalText,
  regionName: optionalText,
  properties: fc.dictionary(
    text,
    fc.oneof(text, fc.double({ noNaN: true, noDefaultInfinity: true }), fc.boolean()),
    { noNullPrototype: true },
  ),
});

describe('the events CSV, for any value', () => {
  it('reads a field back as its value, with a leading formula character guarded', () => {
    fc.assert(
      fc.property(text, (value) => {
        expect(readField(value)).toBe(guarded(value));
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('never lets a field read back start a spreadsheet formula', () => {
    fc.assert(
      fc.property(optionalText, (value) => {
        const field = readField(value);

        expect(FORMULA_TRIGGERS.filter((trigger) => field.startsWith(trigger))).toEqual([]);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('writes an event as one well-formed record, each column holding its value', () => {
    const columns = readCsvRecord(EVENT_CSV_HEADER);

    fc.assert(
      fc.property(exportedEvent, (event) => {
        const fields = readCsvRecord(eventCsvLine(event));

        expect(fields).toHaveLength(columns.length);
        expect(Object.fromEntries(columns.map((column, index) => [column, fields[index]]))).toEqual(
          {
            id: guarded(event.id),
            occurred_at: event.occurredAt.toISOString(),
            name: guarded(event.name),
            path: guarded(event.path),
            session_id: guarded(event.sessionId),
            user_id: guarded(event.userId ?? ''),
            referrer_host: guarded(event.referrerHost ?? ''),
            utm_source: guarded(event.utmSource ?? ''),
            utm_medium: guarded(event.utmMedium ?? ''),
            utm_campaign: guarded(event.utmCampaign ?? ''),
            from_ad_click: String(event.fromAdClick),
            channel: guarded(event.channel ?? ''),
            device_type: guarded(event.deviceType),
            browser: guarded(event.browser),
            os: guarded(event.os),
            country: guarded(event.country ?? ''),
            region: guarded(event.region ?? ''),
            region_name: guarded(event.regionName ?? ''),
            properties: JSON.stringify(event.properties),
          },
        );
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
