import { buildTrackedEvent, type ReceptionContext } from './build-tracked-event';
import type { AcceptedEvent } from './validate-event';

const RECEIVED_AT = new Date('2026-10-06T14:00:10.000Z');

const CONTEXT: ReceptionContext = {
  projectId: 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8',
  sentAt: new Date('2026-10-06T14:00:40.000Z'),
  receivedAt: RECEIVED_AT,
  device: { deviceType: 'mobile', browser: 'safari', os: 'ios' },
  country: 'BR',
};

const EVENT: AcceptedEvent = {
  id: '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
  name: 'plan_selected',
  occurredAt: new Date('2026-10-06T14:00:35.000Z'),
  sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
  userId: 'user_42',
  path: '/pricing',
  attribution: null,
  properties: { plan: 'pro' },
};

describe('buildTrackedEvent', () => {
  it('stamps the project, the reception, the device and the country, and corrects the clock', () => {
    expect(buildTrackedEvent(EVENT, CONTEXT)).toEqual({
      id: EVENT.id,
      projectId: CONTEXT.projectId,
      name: 'plan_selected',
      occurredAt: new Date('2026-10-06T14:00:05.000Z'),
      receivedAt: RECEIVED_AT,
      sessionId: EVENT.sessionId,
      userId: 'user_42',
      path: '/pricing',
      attribution: null,
      channel: null,
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      properties: { plan: 'pro' },
    });
  });

  it('classifies the channel only for the event that carries attribution', () => {
    const entry: AcceptedEvent = {
      ...EVENT,
      name: 'page_view',
      properties: {},
      attribution: {
        referrerHost: 'google.com.br',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        fromAdClick: false,
      },
    };

    expect(buildTrackedEvent(entry, CONTEXT).channel).toBe('organic');
  });

  it('holds no field for the user agent or the address', () => {
    const keys = Object.keys(buildTrackedEvent(EVENT, CONTEXT));

    expect(keys.filter((key) => /agent|address|ip/i.test(key))).toEqual([]);
  });
});
