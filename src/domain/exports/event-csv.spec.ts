import { readCsvRecord } from '../../test-utils/csv-reader';
import { csvField, EVENT_CSV_HEADER, eventCsvLine } from './event-csv';
import type { ExportedEvent } from './exported-event';

const EVENT: ExportedEvent = {
  id: '11111111-0000-4000-8000-000000000001',
  occurredAt: new Date('2026-11-02T13:00:00.000Z'),
  name: 'plan_selected',
  path: '/pricing',
  sessionId: '22222222-0000-4000-8000-000000000002',
  userId: null,
  referrerHost: 'www.google.com',
  utmSource: 'newsletter',
  utmMedium: null,
  utmCampaign: null,
  fromAdClick: false,
  channel: 'campaign',
  deviceType: 'desktop',
  browser: 'chrome',
  os: 'windows',
  country: 'BR',
  region: 'BR-SP',
  regionName: 'São Paulo',
  properties: { plan: 'yearly', seats: 3 },
};

describe('the events CSV', () => {
  it('names one column per field, ending the line as RFC 4180 says', () => {
    expect(EVENT_CSV_HEADER).toBe(
      'id,occurred_at,name,path,session_id,user_id,referrer_host,utm_source,utm_medium,' +
        'utm_campaign,from_ad_click,channel,device_type,browser,os,country,region,region_name,' +
        'properties\r\n',
    );
  });

  it('writes an event as one line, with empty fields for what it lacks and the properties as JSON', () => {
    expect(eventCsvLine(EVENT)).toBe(
      '11111111-0000-4000-8000-000000000001,2026-11-02T13:00:00.000Z,plan_selected,/pricing,' +
        '22222222-0000-4000-8000-000000000002,,' +
        'www.google.com,newsletter,,,false,campaign,desktop,chrome,windows,BR,BR-SP,São Paulo,' +
        '"{""plan"":""yearly"",""seats"":3}"\r\n',
    );
  });

  it('round-trips a value with a quote, a comma and a line break', () => {
    const value = 'say "hi",\nthen leave';
    const line = eventCsvLine({ ...EVENT, utmCampaign: value });

    expect(readCsvRecord(line)[9]).toBe(value);
  });

  it('keeps a spreadsheet from running a value as a formula', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-1')).toBe("'-1");
    expect(csvField('@sum')).toBe("'@sum");
    expect(csvField('plain')).toBe('plain');
    expect(csvField(null)).toBe('');
  });
});
