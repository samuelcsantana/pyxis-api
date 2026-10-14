import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { LazyMailSender } from './lazy-mail-sender';

const NOTICE: QuotaNotice = {
  kind: 'quota_paused',
  events: 150_000,
  limit: 100_000,
  month: '2026-10',
  measuredAt: new Date('2026-10-14T03:00:00.000Z'),
  resumesAt: new Date('2026-11-01T00:00:00.000Z'),
};

describe('LazyMailSender', () => {
  it('creates the real sender only when the first e-mail goes out, and only once', async () => {
    const recording = new RecordingMailSender();
    const create = jest.fn(() => recording);
    const sender = new LazyMailSender(create);

    expect(create).not.toHaveBeenCalled();
    await sender.sendSignInCode('ana@example.com', '123456', 'en');
    await sender.sendSignUpCode('bia@example.com', '654321', 'es');
    await sender.sendQuotaNotice('ana@example.com', NOTICE, 'pt-BR');
    await sender.sendWeeklyDigest('ana@example.com', { projectId: 'p' } as WeeklyDigest, 'es');

    expect(create).toHaveBeenCalledTimes(1);
    expect(recording.sent).toHaveLength(1);
    expect(recording.signUpCodes).toEqual([
      { email: 'bia@example.com', code: '654321', language: 'es' },
    ]);
    expect(recording.quotaNotices).toHaveLength(1);
    expect(recording.digests).toHaveLength(1);
  });

  it('turns a sender that cannot be created into a failed send, not a failed start', async () => {
    const sender = new LazyMailSender(() => {
      throw new Error('RESEND_API_KEY is required in production');
    });

    await expect(sender.sendQuotaNotice('ana@example.com', NOTICE, 'en')).rejects.toThrow(
      'RESEND_API_KEY is required in production',
    );
  });
});
