import type { TrackedEvent } from '../../domain/entities/tracked-event.entity';
import { toEventRow } from './drizzle-event.repository';

const EVENT: TrackedEvent = {
  id: '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
  projectId: 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8',
  name: 'page_view',
  occurredAt: new Date('2026-10-06T14:00:05.000Z'),
  receivedAt: new Date('2026-10-06T14:00:10.000Z'),
  sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
  userId: null,
  path: '/',
  attribution: null,
  channel: null,
  deviceType: 'desktop',
  browser: 'firefox',
  os: 'linux',
  country: null,
  properties: {},
};

describe('toEventRow', () => {
  it('stores an event without attribution with empty campaign columns', () => {
    expect(toEventRow(EVENT)).toMatchObject({
      referrerHost: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      fromAdClick: false,
      channel: null,
    });
  });

  it('flattens the attribution of an entry page view into its columns', () => {
    const entry: TrackedEvent = {
      ...EVENT,
      channel: 'paid',
      attribution: {
        referrerHost: 'google.com',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'launch',
        fromAdClick: true,
      },
    };

    expect(toEventRow(entry)).toMatchObject({
      referrerHost: 'google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'launch',
      fromAdClick: true,
      channel: 'paid',
    });
  });
});
