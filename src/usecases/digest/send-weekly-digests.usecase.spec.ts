import { Logger } from '@nestjs/common';
import type { DigestRecipient } from '../../domain/digest/digest-recipients';
import type { Project } from '../../domain/entities/project.entity';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryDigestDeliveryRepository } from '../../test-utils/in-memory-digest-delivery.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { StubDigestRecipientsQuery } from '../../test-utils/stub-digest-recipients.query';
import { StubOverviewQuery } from '../../test-utils/stub-overview.query';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { StubRequestsQuery } from '../../test-utils/stub-requests.query';
import { BuildWeeklyDigestUseCase } from './build-weekly-digest.usecase';
import { SendWeeklyDigestsUseCase } from './send-weekly-digests.usecase';

const MONDAY_SEND_TIME = new Date('2026-10-12T11:00:00.000Z');
const SHOP: Project = {
  id: 'shop',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const ISLAND: Project = { ...SHOP, id: 'island', name: 'Island', timezone: 'Etc/GMT+12' };

function recipient(
  adminUserId: string,
  project: Project,
  emailLanguage: DigestRecipient['emailLanguage'] = 'en',
): DigestRecipient {
  return { adminUserId, email: `${adminUserId}@example.com`, emailLanguage, project };
}

function setup(recipients: readonly DigestRecipient[]) {
  const query = new StubDigestRecipientsQuery();
  query.answer = recipients;
  const deliveries = new InMemoryDigestDeliveryRepository();
  const overview = new StubOverviewQuery();
  const mail = new RecordingMailSender();
  const clock = new FixedClock(MONDAY_SEND_TIME);
  const build = new BuildWeeklyDigestUseCase(
    overview,
    new StubRequestsQuery(),
    new StubProjectActivityQuery(),
  );
  return {
    deliveries,
    overview,
    mail,
    clock,
    send: new SendWeeklyDigestsUseCase(query, deliveries, build, mail, clock),
  };
}

describe('SendWeeklyDigestsUseCase', () => {
  let logs: { level: string; message: unknown }[];

  beforeEach(() => {
    logs = [];
    const record = (level: string) => (message: unknown) => {
      logs.push({ level, message });
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record('log'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record('error'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends each admin the project's last closed week in their language, and remembers it", async () => {
    const { send, mail, deliveries } = setup([
      recipient('ana', SHOP),
      recipient('bruno', SHOP, 'pt-BR'),
    ]);

    expect(await send.execute()).toEqual({ sent: 2, alreadySent: 0, failed: 0 });

    expect(
      mail.digests.map(({ email, language, digest }) => [email, language, digest.week]),
    ).toEqual([
      ['ana@example.com', 'en', { from: '2026-10-05', to: '2026-10-11' }],
      ['bruno@example.com', 'pt-BR', { from: '2026-10-05', to: '2026-10-11' }],
    ]);
    expect(deliveries.sent).toEqual([
      { projectId: 'shop', adminUserId: 'ana', weekStart: '2026-10-05', sentAt: MONDAY_SEND_TIME },
      {
        projectId: 'shop',
        adminUserId: 'bruno',
        weekStart: '2026-10-05',
        sentAt: MONDAY_SEND_TIME,
      },
    ]);
  });

  it("builds a project's week once, however many admins receive it", async () => {
    const { send, overview } = setup([recipient('ana', SHOP), recipient('bruno', SHOP)]);

    await send.execute();

    expect(overview.limits).toEqual([5, 5]);
  });

  it('takes the week that has ended where each project is', async () => {
    const { send, mail } = setup([recipient('ana', SHOP), recipient('ana', ISLAND)]);

    await send.execute();

    expect(mail.digests.map(({ digest }) => [digest.projectId, digest.week.from])).toEqual([
      ['shop', '2026-10-05'],
      ['island', '2026-09-28'],
    ]);
  });

  it('sends only what is missing when it runs again', async () => {
    const { send, mail, deliveries } = setup([recipient('ana', SHOP), recipient('bruno', SHOP)]);
    await deliveries.recordSent(
      { projectId: 'shop', adminUserId: 'ana', weekStart: '2026-10-05' },
      MONDAY_SEND_TIME,
    );

    expect(await send.execute()).toEqual({ sent: 1, alreadySent: 1, failed: 0 });
    expect(await send.execute()).toEqual({ sent: 0, alreadySent: 2, failed: 0 });

    expect(mail.digests.map(({ email }) => email)).toEqual(['bruno@example.com']);
  });

  it('goes on after an admin whose e-mail fails, and leaves that one to be sent again', async () => {
    const { send, mail, deliveries } = setup([recipient('ana', SHOP), recipient('bruno', SHOP)]);
    mail.failFor('ana@example.com', new Error('Resend answered 500'));

    expect(await send.execute()).toEqual({ sent: 1, alreadySent: 0, failed: 1 });

    expect(mail.digests.map(({ email }) => email)).toEqual(['bruno@example.com']);
    expect(deliveries.sent.map(({ adminUserId }) => adminUserId)).toEqual(['bruno']);
    expect(logs).toContainEqual({
      level: 'error',
      message: {
        message: 'digest.delivery_failed',
        projectId: 'shop',
        adminUserId: 'ana',
        weekStart: '2026-10-05',
        error: 'Resend answered 500',
      },
    });
    expect(JSON.stringify(logs)).not.toContain('@example.com');
  });

  it('logs a failure that is not an Error too', async () => {
    const { send, mail } = setup([recipient('ana', SHOP)]);
    const failure: unknown = 'timeout';
    mail.failFor('ana@example.com', failure as Error);

    await send.execute();

    expect(logs).toContainEqual({
      level: 'error',
      message: expect.objectContaining({ error: 'timeout' }) as object,
    });
  });

  it('logs every digest sent and the totals, by id only', async () => {
    const { send } = setup([recipient('ana', SHOP)]);

    await send.execute();

    expect(logs).toEqual([
      {
        level: 'log',
        message: {
          message: 'digest.sent',
          projectId: 'shop',
          adminUserId: 'ana',
          weekStart: '2026-10-05',
        },
      },
      {
        level: 'log',
        message: { message: 'digest.completed', sent: 1, alreadySent: 0, failed: 0 },
      },
    ]);
  });

  it('sends nothing when nobody keeps the digest on', async () => {
    const { send, mail } = setup([]);

    expect(await send.execute()).toEqual({ sent: 0, alreadySent: 0, failed: 0 });
    expect(mail.digests).toEqual([]);
  });
});
