import type { AccountNotice } from '../../domain/accounts/account-notice';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { buildAccountNoticeEmail } from './account-notice-email';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';

const LINKS = emailLinksFor('https://dashboard.example.com');
const DELETION_ON = new Date('2026-12-14T00:00:00.000Z');
const ENDED: AccountNotice = { kind: 'access_ended', deletionOn: DELETION_ON };
const REMINDER: AccountNotice = { kind: 'deletion_reminder', deletionOn: DELETION_ON };
const DELETED: AccountNotice = { kind: 'account_deleted' };
const NOTICES: readonly AccountNotice[] = [ENDED, REMINDER, DELETED];

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildAccountNoticeEmail', () => {
  it('tells the owner the subscription ended, the keys were revoked and when the data goes', () => {
    const email = buildAccountNoticeEmail(ENDED, 'en', LINKS, null);

    expect(email.subject).toBe('Your Pyxis subscription has ended');
    expect(email.html).toContain('its keys were revoked');
    expect(email.html).toContain('The reports stay readable until December 14, 2026.');
    expect(email.text).toContain('export it from the account page');
  });

  it('reminds the owner of the deletion date, in their language', () => {
    expect(buildAccountNoticeEmail(REMINDER, 'pt-BR', LINKS, null).subject).toBe(
      'Seus dados no Pyxis serão apagados em 14 de dezembro de 2026',
    );
    expect(buildAccountNoticeEmail(REMINDER, 'es', LINKS, null).subject).toBe(
      'Tus datos en Pyxis se eliminarán el 14 de diciembre de 2026',
    );
  });

  it('confirms the deletion without a date', () => {
    const email = buildAccountNoticeEmail(DELETED, 'en', LINKS, null);

    expect(email.subject).toBe('Your Pyxis account was deleted');
    expect(email.html).toContain('Nothing of them is left in Pyxis.');
  });

  it('names the support address only when there is one', () => {
    const withSupport = buildAccountNoticeEmail(DELETED, 'en', LINKS, 'hello@example.com');
    const without = buildAccountNoticeEmail(DELETED, 'en', LINKS, null);

    expect(withSupport.text).toContain('write to hello@example.com.');
    expect(without.text).not.toContain('write to');
  });

  it('declares its language and keeps every plain-text line short, for every notice', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const notice of NOTICES) {
        const email = buildAccountNoticeEmail(notice, language, LINKS, 'hello@example.com');
        expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
        expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      }
    }
  });
});
