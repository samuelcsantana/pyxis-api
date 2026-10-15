import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildInvitationEmail } from './invitation-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const INVITATION = { projectName: 'Shop', inviterEmail: 'ana@example.com' };

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildInvitationEmail', () => {
  it('names who added the reader and to which project, in each language', () => {
    expect(buildInvitationEmail(INVITATION, 'en', LINKS).subject).toBe(
      'ana@example.com added you to Shop on Pyxis',
    );
    expect(buildInvitationEmail(INVITATION, 'pt-BR', LINKS).subject).toBe(
      'ana@example.com adicionou você ao projeto Shop no Pyxis',
    );
    expect(buildInvitationEmail(INVITATION, 'es', LINKS).subject).toBe(
      'ana@example.com te agregó al proyecto Shop en Pyxis',
    );
  });

  it('explains how to sign in without a password, with a button to the dashboard', () => {
    const email = buildInvitationEmail(INVITATION, 'en', LINKS);

    expect(email.html).toContain('You can now see Shop');
    expect(email.html).toContain('only the owner of the account changes its settings.');
    expect(email.html).toContain('a sign-in code arrives by email.');
    expect(email.html).toContain(`<a href="${LINKS.dashboardUrl}" style="display:inline-block;`);
    expect(email.html).toContain('Open the dashboard</a>');
    expect(email.text).toContain(`Open the dashboard: ${LINKS.dashboardUrl}`);
    expect(email.text).toContain('You can ignore this email');
  });

  it('declares its language', () => {
    expect(buildInvitationEmail(INVITATION, 'pt-BR', LINKS).html).toContain(
      '<html lang="pt-BR" dir="ltr">',
    );
  });

  it('escapes the project name in the HTML and keeps it on one line in the subject', () => {
    const email = buildInvitationEmail(
      { projectName: '<b>Shop</b>\n & Co', inviterEmail: 'ana@example.com' },
      'en',
      LINKS,
    );

    expect(email.subject).toBe('ana@example.com added you to <b>Shop</b> & Co on Pyxis');
    expect(email.html).toContain('&lt;b&gt;Shop&lt;/b&gt; &amp; Co');
    expect(email.html).not.toContain('<b>Shop</b>');
  });

  it('keeps every plain-text line short enough for mail servers and plain-text readers', () => {
    for (const language of EMAIL_LANGUAGES) {
      expect(
        longestLine(buildInvitationEmail(INVITATION, language, LINKS).text),
      ).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
    }
  });
});
