import { Logger } from '@nestjs/common';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { ExportLimitReachedError, ExportNotFoundError } from '../../domain/errors/export.errors';
import { EVENT_CSV_HEADER } from '../../domain/exports/event-csv';
import type { ExportedEvent } from '../../domain/exports/exported-event';
import {
  EXPORT_BATCH_SIZE,
  EXPORTS_PER_PROJECT_PER_DAY,
} from '../../domain/exports/project-export';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import {
  InMemoryExportStorage,
  InMemoryProjectExportRepository,
  RecordingExportDispatcher,
} from '../../test-utils/in-memory-project-export.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { GetProjectExportUseCase } from './get-project-export.usecase';
import { exportFileName, ProcessProjectExportUseCase } from './process-project-export.usecase';
import { RequestProjectExportUseCase } from './request-project-export.usecase';

const NOW = new Date('2026-11-02T13:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const STRANGER_ID = 'ad000000-0000-4000-a000-000000000002';

function eventAt(index: number): ExportedEvent {
  return {
    id: `11111111-0000-4000-8000-${String(index).padStart(12, '0')}`,
    occurredAt: new Date(Date.UTC(2026, 9, 1) + index * 1000),
    name: 'page_view',
    path: '/',
    sessionId: '22222222-0000-4000-8000-000000000002',
    userId: null,
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    fromAdClick: false,
    channel: 'direct',
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

async function setup(status: 'active' | 'ended' = 'active') {
  const clock = new FixedClock(NOW);
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const created = await store.createWithPublicKeyInAccount(
    {
      name: 'My Shop',
      allowedOrigins: ['https://shop.example.com'],
      timezone: 'UTC',
      conversionEvent: null,
    },
    'pyxis_pk_shop',
    { accountId: account.id, maxProjects: 3 },
  );
  if (created.outcome !== 'created') {
    throw new Error(`expected a project, got ${created.outcome}`);
  }
  const projectId = created.created.project.id;
  const exports = new InMemoryProjectExportRepository();
  exports.addProject(projectId, 'My Shop', [eventAt(2), eventAt(1)]);
  exports.addRequester(OWNER_ID, { email: 'owner@example.com', language: 'pt-BR' });
  const storage = new InMemoryExportStorage();
  const dispatcher = new RecordingExportDispatcher();
  const mail = new RecordingMailSender();
  return {
    clock,
    projectId,
    exports,
    storage,
    dispatcher,
    mail,
    request: new RequestProjectExportUseCase(store, accounts, exports, dispatcher, clock),
    get: new GetProjectExportUseCase(store, accounts, exports, storage, clock),
    process: new ProcessProjectExportUseCase(exports, exports, storage, mail, clock),
  };
}

describe('exporting a project', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the request and hands it to the jobs function, even after the account ended', async () => {
    const { request, dispatcher, projectId } = await setup('ended');

    const requested = await request.execute({ adminUserId: OWNER_ID, projectId });

    expect(requested).toEqual({
      requested: true,
      projectExport: expect.objectContaining({
        projectId,
        status: 'pending',
        requestedBy: OWNER_ID,
      }) as unknown,
    });
    expect(dispatcher.dispatched).toEqual([requested.projectExport.id]);
  });

  it('answers the export already waiting instead of a second one', async () => {
    const { request, dispatcher, projectId } = await setup();
    const first = await request.execute({ adminUserId: OWNER_ID, projectId });

    const again = await request.execute({ adminUserId: OWNER_ID, projectId });

    expect(again).toEqual({ requested: false, projectExport: first.projectExport });
    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('allows three exports a day per project', async () => {
    const { request, process, projectId } = await setup();
    for (let done = 0; done < EXPORTS_PER_PROJECT_PER_DAY; done += 1) {
      const { projectExport } = await request.execute({ adminUserId: OWNER_ID, projectId });
      await process.execute(projectExport.id);
    }

    await expect(request.execute({ adminUserId: OWNER_ID, projectId })).rejects.toBeInstanceOf(
      ExportLimitReachedError,
    );
  });

  it('keeps the request when the jobs function cannot be reached, for the daily job', async () => {
    const { request, dispatcher, exports, projectId } = await setup();
    dispatcher.failure = new Error('throttled');

    const requested = await request.execute({ adminUserId: OWNER_ID, projectId });

    expect(exports.stored(requested.projectExport.id)?.status).toBe('pending');
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'exports.dispatch_failed' }),
    );
  });

  it('answers not found to anyone but the owner', async () => {
    const { request, get, projectId } = await setup();

    await expect(request.execute({ adminUserId: STRANGER_ID, projectId })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
    await expect(
      get.execute({ adminUserId: STRANGER_ID, projectId, exportId: 'any' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('writes every event in order, in batches, then tells the requester the file is ready', async () => {
    const { request, process, storage, mail, exports, projectId } = await setup();
    exports.addProject(
      projectId,
      'My Shop',
      Array.from({ length: EXPORT_BATCH_SIZE + 2 }, (_, index) =>
        eventAt(EXPORT_BATCH_SIZE + 2 - index),
      ),
    );
    const { projectExport } = await request.execute({ adminUserId: OWNER_ID, projectId });

    expect(await process.execute(projectExport.id)).toBe('done');

    const file = storage.files.get(`exports/${projectId}/${projectExport.id}.csv.gz`);
    const lines = file?.content.split('\r\n') ?? [];
    expect(file?.fileName).toBe('pyxis-my-shop-2026-11-02.csv.gz');
    expect(`${lines[0] ?? ''}\r\n`).toBe(EVENT_CSV_HEADER);
    expect(lines).toHaveLength(EXPORT_BATCH_SIZE + 4);
    expect(lines[1]).toContain(eventAt(1).id);
    expect(exports.pagesAsked).toHaveLength(2);
    expect(exports.stored(projectExport.id)).toEqual(
      expect.objectContaining({
        status: 'done',
        eventCount: EXPORT_BATCH_SIZE + 2,
        finishedAt: NOW,
      }),
    );
    expect(mail.exportsReady).toEqual([
      {
        email: 'owner@example.com',
        ready: {
          projectId,
          exportId: projectExport.id,
          projectName: 'My Shop',
          eventCount: EXPORT_BATCH_SIZE + 2,
          availableUntil: new Date('2026-11-09T13:00:00.000Z'),
        },
        language: 'pt-BR',
      },
    ]);
  });

  it('writes the header alone for a project without events', async () => {
    const { request, process, storage, exports, projectId } = await setup();
    exports.addProject(projectId, 'My Shop', []);
    const { projectExport } = await request.execute({ adminUserId: OWNER_ID, projectId });

    await process.execute(projectExport.id);

    expect([...storage.files.values()][0]?.content).toBe(EVENT_CSV_HEADER);
  });

  it('keeps the file when the e-mail fails, and sends none when the requester is gone', async () => {
    const failing = await setup();
    failing.mail.failFor('owner@example.com', new Error('provider down'));
    const first = await failing.request.execute({
      adminUserId: OWNER_ID,
      projectId: failing.projectId,
    });
    const gone = await setup();
    gone.exports.add({
      id: 'orphan',
      projectId: gone.projectId,
      requestedBy: null,
      requestedAt: NOW,
      status: 'pending',
      finishedAt: null,
      objectKey: null,
      eventCount: null,
    });

    expect(await failing.process.execute(first.projectExport.id)).toBe('done');
    expect(await gone.process.execute('orphan')).toBe('done');
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'exports.notice_failed' }),
    );
    expect(gone.mail.exportsReady).toEqual([]);
  });

  it('marks the export failed and fails the run when the file cannot be written', async () => {
    const { request, process, storage, exports, projectId } = await setup();
    storage.failure = new Error('bucket gone');
    const { projectExport } = await request.execute({ adminUserId: OWNER_ID, projectId });

    await expect(process.execute(projectExport.id)).rejects.toThrow('bucket gone');
    expect(exports.stored(projectExport.id)?.status).toBe('failed');
  });

  it('skips an export that is not waiting', async () => {
    const { process } = await setup();

    expect(await process.execute('missing')).toBe('skipped');
  });

  it('runs the exports left waiting for more than fifteen minutes, counting failures', async () => {
    const { process, exports, storage, projectId } = await setup();
    const waiting = (id: string, minutesAgo: number) => {
      exports.add({
        id,
        projectId,
        requestedBy: OWNER_ID,
        requestedAt: new Date(NOW.getTime() - minutesAgo * 60_000),
        status: 'pending',
        finishedAt: null,
        objectKey: null,
        eventCount: null,
      });
    };
    waiting('old', 30);
    waiting('recent', 5);

    expect(await process.processStalled()).toEqual({ done: 1, failed: 0 });
    expect(exports.stored('recent')?.status).toBe('pending');

    waiting('older', 60);
    storage.failure = new Error('bucket gone');
    expect(await process.processStalled()).toEqual({ done: 0, failed: 1 });
  });

  it('counts nothing for a stalled export another run finished in between', async () => {
    const { process, exports, projectId } = await setup();
    exports.add({
      id: 'raced',
      projectId,
      requestedBy: OWNER_ID,
      requestedAt: new Date(NOW.getTime() - 30 * 60_000),
      status: 'pending',
      finishedAt: null,
      objectKey: null,
      eventCount: null,
    });
    jest.spyOn(exports, 'pendingTarget').mockResolvedValueOnce(null);

    expect(await process.processStalled()).toEqual({ done: 0, failed: 0 });
  });

  it('gives a short download link while the file exists, and none before or after', async () => {
    const { request, process, get, clock, projectId, exports } = await setup();
    const { projectExport } = await request.execute({ adminUserId: OWNER_ID, projectId });
    const ask = () => get.execute({ adminUserId: OWNER_ID, projectId, exportId: projectExport.id });

    expect(await ask()).toEqual({ projectExport, availableUntil: null, downloadUrl: null });

    await process.execute(projectExport.id);
    expect(await ask()).toEqual(
      expect.objectContaining({
        availableUntil: new Date('2026-11-09T13:00:00.000Z'),
        downloadUrl: `https://storage.example.com/exports/${projectId}/${projectExport.id}.csv.gz?expires=300`,
      }),
    );

    clock.advanceBy(7 * 24 * 60 * 60 * 1000);
    expect((await ask()).downloadUrl).toBeNull();

    exports.add({ ...projectExport, id: 'failed', status: 'failed', finishedAt: NOW });
    expect(
      (await get.execute({ adminUserId: OWNER_ID, projectId, exportId: 'failed' })).downloadUrl,
    ).toBeNull();
  });

  it('answers not found for an export of another project', async () => {
    const { get, projectId } = await setup();

    await expect(
      get.execute({ adminUserId: OWNER_ID, projectId, exportId: 'missing' }),
    ).rejects.toBeInstanceOf(ExportNotFoundError);
  });
});

describe('exportFileName', () => {
  it('names the file after the project and the day, with a safe fallback', () => {
    expect(exportFileName('  Loja do Zé! ', NOW)).toBe('pyxis-loja-do-z-2026-11-02.csv.gz');
    expect(exportFileName('!!!', NOW)).toBe('pyxis-project-2026-11-02.csv.gz');
  });
});
