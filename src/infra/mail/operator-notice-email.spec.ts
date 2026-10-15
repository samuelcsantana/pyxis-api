import { emailLinksFor } from './email-layout';
import { buildOperatorNoticeEmail } from './operator-notice-email';

const LINKS = emailLinksFor('https://app.example.com');
const NOTICE = {
  subject: 'Prices <change> on December 1',
  paragraphs: [
    'From December 1 the monthly plan costs R$ 49 & the yearly one stays at R$ 390, as before.',
    'Nothing changes until your next renewal.',
  ],
};

describe('buildOperatorNoticeEmail', () => {
  it('writes the subject and the paragraphs as given, escaped in the HTML', () => {
    const email = buildOperatorNoticeEmail(NOTICE, 'en', LINKS, 'hello@example.com');

    expect(email.subject).toBe('Prices <change> on December 1');
    expect(email.html).toContain('Prices &lt;change&gt; on December 1');
    expect(email.html).toContain('R$ 49 &amp; the yearly one');
    expect(email.html).not.toContain('<change>');
    expect(email.html).toContain('lang="en"');
    expect(email.text).toContain('Nothing changes until your next renewal.');
    expect(email.text).toContain('hello@example.com');
    expect(email.text).toContain('https://app.example.com/');
  });

  it('uses the footnotes of the language and leaves out the support line without an address', () => {
    const email = buildOperatorNoticeEmail(NOTICE, 'pt-BR', LINKS, null);

    expect(email.text).toContain('Painel: https://app.example.com/');
    expect(email.text).not.toContain('hello@');
    expect(Math.max(...email.text.split('\n').map((line) => line.length))).toBeLessThanOrEqual(72);
  });
});
