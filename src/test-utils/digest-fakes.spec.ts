import { InMemoryDigestDeliveryRepository } from './in-memory-digest-delivery.repository';
import { StubDigestRecipientsQuery } from './stub-digest-recipients.query';

const DELIVERY = { projectId: 'shop', adminUserId: 'ana', weekStart: '2026-10-05' };
const SENT_AT = new Date('2026-10-12T11:00:00.000Z');

describe('InMemoryDigestDeliveryRepository', () => {
  it('remembers a digest once, per project, admin and week', async () => {
    const deliveries = new InMemoryDigestDeliveryRepository();

    await deliveries.recordSent(DELIVERY, SENT_AT);
    await deliveries.recordSent(DELIVERY, new Date('2026-10-12T12:00:00.000Z'));

    expect(deliveries.sent).toEqual([{ ...DELIVERY, sentAt: SENT_AT }]);
    expect(await deliveries.wasSent(DELIVERY)).toBe(true);
    expect(await deliveries.wasSent({ ...DELIVERY, projectId: 'blog' })).toBe(false);
    expect(await deliveries.wasSent({ ...DELIVERY, adminUserId: 'bruno' })).toBe(false);
    expect(await deliveries.wasSent({ ...DELIVERY, weekStart: '2026-10-12' })).toBe(false);
  });
});

describe('StubDigestRecipientsQuery', () => {
  it('answers no recipient until told otherwise', async () => {
    expect(await new StubDigestRecipientsQuery().recipients()).toEqual([]);
  });
});
