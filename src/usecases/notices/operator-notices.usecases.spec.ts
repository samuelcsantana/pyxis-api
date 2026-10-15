import { Logger } from '@nestjs/common';
import { NoticeCampaignExistsError } from '../../domain/errors/notice.errors';
import type { NoticeContent } from '../../domain/notices/operator-notice';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryNoticeRepository } from '../../test-utils/in-memory-notice.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { CreateOperatorNoticeUseCase } from './create-operator-notice.usecase';
import { SendOperatorNoticesUseCase } from './send-operator-notices.usecase';

const NOW = new Date('2026-11-02T12:00:00.000Z');
const CONTENT: NoticeContent = {
  en: { subject: 'Prices change', paragraphs: ['From December the plan costs more.'] },
  'pt-BR': { subject: 'Os preços mudam', paragraphs: ['A partir de dezembro o plano custa mais.'] },
  es: { subject: 'Los precios cambian', paragraphs: ['Desde diciembre el plan cuesta más.'] },
};

function setup() {
  const notices = new InMemoryNoticeRepository();
  notices.addRecipient({
    accountId: 'acc-ana',
    status: 'active',
    ownerEmail: 'ana@example.com',
    ownerLanguage: 'pt-BR',
  });
  notices.addRecipient({
    accountId: 'acc-bia',
    status: 'comped',
    ownerEmail: 'bia@example.com',
    ownerLanguage: 'en',
  });
  notices.addRecipient({
    accountId: 'acc-gone',
    status: 'ended',
    ownerEmail: 'gone@example.com',
    ownerLanguage: 'es',
  });
  notices.addRecipient({
    accountId: 'acc-new',
    status: 'incomplete',
    ownerEmail: 'new@example.com',
    ownerLanguage: 'en',
  });
  const mail = new RecordingMailSender();
  const clock = new FixedClock(NOW);
  return {
    notices,
    mail,
    create: new CreateOperatorNoticeUseCase(notices, clock),
    send: new SendOperatorNoticesUseCase(notices, mail, clock),
  };
}

describe('CreateOperatorNoticeUseCase', () => {
  it('counts the owners a dry run would reach, storing nothing', async () => {
    const { create, send, mail } = setup();

    await expect(
      create.execute({ campaign: 'prices', content: CONTENT, includeEnded: false, dryRun: true }),
    ).resolves.toEqual({
      campaign: 'prices',
      created: false,
      recipients: 2,
      byLanguage: { en: 1, 'pt-BR': 1, es: 0 },
    });
    await send.execute();
    expect(mail.operatorNotices).toEqual([]);
  });

  it('stores one delivery per owner of an account with access, the ended ones only when asked', async () => {
    const { create } = setup();

    await expect(
      create.execute({ campaign: 'prices', content: CONTENT, includeEnded: false, dryRun: false }),
    ).resolves.toMatchObject({ created: true, recipients: 2 });
    await expect(
      create.execute({ campaign: 'terms', content: CONTENT, includeEnded: true, dryRun: false }),
    ).resolves.toMatchObject({ recipients: 3, byLanguage: { en: 1, 'pt-BR': 1, es: 1 } });
  });

  it('refuses a campaign name already used', async () => {
    const { create } = setup();
    await create.execute({
      campaign: 'prices',
      content: CONTENT,
      includeEnded: false,
      dryRun: false,
    });

    await expect(
      create.execute({ campaign: 'prices', content: CONTENT, includeEnded: false, dryRun: false }),
    ).rejects.toBeInstanceOf(NoticeCampaignExistsError);
  });
});

describe('SendOperatorNoticesUseCase', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends each pending notice once, in the owner's language", async () => {
    const { create, send, mail, notices } = setup();
    await create.execute({
      campaign: 'prices',
      content: CONTENT,
      includeEnded: false,
      dryRun: false,
    });

    await expect(send.execute()).resolves.toEqual({ sent: 2, failed: 0 });
    await expect(send.execute()).resolves.toEqual({ sent: 0, failed: 0 });
    expect(mail.operatorNotices).toEqual([
      { email: 'ana@example.com', notice: CONTENT['pt-BR'], language: 'pt-BR' },
      { email: 'bia@example.com', notice: CONTENT.en, language: 'en' },
    ]);
    expect(notices.sentAt('notice-1', 'acc-ana')).toEqual(NOW);
  });

  it('keeps going past a failed e-mail, logging it and leaving it for the next run', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { create, send, mail, notices } = setup();
    await create.execute({
      campaign: 'prices',
      content: CONTENT,
      includeEnded: false,
      dryRun: false,
    });
    mail.failFor('ana@example.com', new Error('SES throttled'));

    await expect(send.execute()).resolves.toEqual({ sent: 1, failed: 1 });
    expect(notices.sentAt('notice-1', 'acc-ana')).toBeNull();
    expect(error).toHaveBeenCalledWith({
      message: 'notices.delivery_failed',
      campaign: 'prices',
      accountId: 'acc-ana',
      reason: 'Error: SES throttled',
    });
  });
});
