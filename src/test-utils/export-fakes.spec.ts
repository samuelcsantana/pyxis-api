import type { ExportedEvent } from '../domain/exports/exported-event';
import { InMemoryProjectExportRepository } from './in-memory-project-export.repository';

const AT = new Date('2026-11-02T13:00:00.000Z');

function event(id: string): ExportedEvent {
  return {
    id,
    occurredAt: AT,
    name: 'page_view',
    path: '/',
    sessionId: 's',
    userId: null,
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    fromAdClick: false,
    channel: null,
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'windows',
    country: null,
    region: null,
    regionName: null,
    city: null,
    properties: {},
  };
}

describe('InMemoryProjectExportRepository', () => {
  it('orders events of the same instant by id, and pages after a cursor', async () => {
    const exports = new InMemoryProjectExportRepository();
    exports.addProject('p', 'Shop', [event('b'), event('a'), event('c')]);

    expect((await exports.page('p', null, 2)).map(({ id }) => id)).toEqual(['a', 'b']);
    expect((await exports.page('p', { occurredAt: AT, id: 'b' }, 2)).map(({ id }) => id)).toEqual([
      'c',
    ]);
    expect(await exports.page('unknown', null, 2)).toEqual([]);
  });

  it('describes a pending export of an unnamed project whose requester it does not know', async () => {
    const exports = new InMemoryProjectExportRepository();
    exports.addProject('elsewhere', 'Elsewhere', []);
    const request = await exports.request('p', 'admin', AT, { since: AT, perDay: 3 });
    if (request.outcome !== 'requested') {
      throw new Error(`expected a request, got ${request.outcome}`);
    }

    expect(await exports.pendingTarget(request.projectExport.id)).toEqual({
      projectExport: request.projectExport,
      projectName: 'p',
      requester: null,
    });
    expect(await exports.findOfProject('other', request.projectExport.id)).toBeNull();
  });
});
