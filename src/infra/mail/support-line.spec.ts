import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import { EMAIL_LANGUAGES, type EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import { buildAccountNoticeEmail } from './account-notice-email';
import { emailLinksFor, type EmailContent, TEXT_LINE_WIDTH } from './email-layout';
import { buildExportReadyEmail } from './export-ready-email';
import { buildInvitationEmail } from './invitation-email';
import { buildOperatorNoticeEmail } from './operator-notice-email';
import { buildQuotaNoticeEmail } from './quota-notice-email';
import { buildSignInCodeEmail, buildSignUpCodeEmail } from './sign-in-code-email';
import { buildSubscriptionConfirmedEmail } from './subscription-confirmed-email';
import { SUPPORT_LINES, supportSentence } from './support-line';
import { buildWeeklyDigestEmail } from './weekly-digest-email';
import { buildWelcomeEmail } from './welcome-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const SUPPORT = 'hello@example.com';
const DIGEST: WeeklyDigest = {
  projectId: 'd2e07854-0000-4000-8000-000000000001',
  projectName: 'Acme Store',
  timeZone: 'UTC',
  week: { from: '2026-10-05', to: '2026-10-11' },
  visits: { current: 12, previous: 10 },
  identifiedUsers: { current: 2, previous: 2 },
  convertingVisits: null,
  failedWrites: { current: { failed: 0, total: 4 }, previous: { failed: 1, total: 3 } },
  days: [{ date: '2026-10-05', visits: 12 }],
  topPages: [],
  topEvents: [],
  failingRoutes: [],
  lastEventAt: null,
};
const FREE_QUOTA_WARNING: QuotaNotice = {
  kind: 'quota_warning',
  plan: 'free',
  percent: 80,
  events: 8_100,
  limit: 10_000,
  month: '2026-10',
  measuredAt: new Date('2026-10-14T03:00:00.000Z'),
  pause: { atEvents: 10_000, until: new Date('2026-11-01T00:00:00.000Z') },
};

type Builder = (language: EmailLanguage, supportEmail: string | null) => EmailContent;

const REPLY_BUILDERS: readonly (readonly [string, Builder])[] = [
  ['sign-in code', (language, support) => buildSignInCodeEmail('123456', language, LINKS, support)],
  ['sign-up code', (language, support) => buildSignUpCodeEmail('654321', language, LINKS, support)],
  [
    'welcome',
    (language, support) =>
      buildWelcomeEmail({ plan: { kind: 'subscription' }, terms: null }, language, LINKS, support),
  ],
  [
    'subscription confirmation',
    (language, support) =>
      buildSubscriptionConfirmedEmail(
        { interval: 'month', withdrawalDays: 7, terms: null },
        language,
        LINKS,
        support,
      ),
  ],
  [
    'export notice',
    (language, support) =>
      buildExportReadyEmail(
        {
          projectId: 'p-1',
          exportId: 'e-1',
          projectName: 'Shop',
          eventCount: 3,
          availableUntil: new Date('2026-11-09T00:00:00.000Z'),
        },
        language,
        LINKS,
        support,
      ),
  ],
  [
    'weekly digest',
    (language, support) => buildWeeklyDigestEmail(DIGEST, language, LINKS, support),
  ],
  [
    'account notice',
    (language, support) =>
      buildAccountNoticeEmail({ kind: 'account_deleted' }, language, LINKS, support),
  ],
  [
    'operator notice',
    (language, support) =>
      buildOperatorNoticeEmail(
        { subject: 'Prices change', paragraphs: ['From December.'] },
        language,
        LINKS,
        support,
      ),
  ],
  [
    'free plan quota notice',
    (language, support) => buildQuotaNoticeEmail(FREE_QUOTA_WARNING, language, LINKS, support),
  ],
];

function occurrences(content: string, part: string): number {
  return content.split(part).length - 1;
}

function flattened(text: string): string {
  return text.replace(/\n/g, ' ');
}

describe('the support line', () => {
  it.each(REPLY_BUILDERS)(
    'closes the %s with the support address once, in the HTML and in the text',
    (_name, build) => {
      const email = build('en', SUPPORT);
      const sentence = `To ask anything, reply to this e-mail or write to ${SUPPORT}.`;

      expect(occurrences(email.html, sentence)).toBe(1);
      expect(occurrences(flattened(email.text), sentence)).toBe(1);
      expect(email.html.indexOf(sentence)).toBeGreaterThan(
        email.html.indexOf('padding:24px 8px 0 8px'),
      );
    },
  );

  it.each(REPLY_BUILDERS)(
    'leaves the support line out of the %s without an address',
    (_name, build) => {
      const email = build('pt-BR', null);

      expect(email.html).not.toContain(SUPPORT);
      expect(email.text).not.toContain(SUPPORT);
      expect(email.text).not.toContain('Para perguntar qualquer coisa');
    },
  );

  it('asks the person invited to write rather than reply, because replies go to whoever invited', () => {
    const email = buildInvitationEmail(
      { projectName: 'Shop', inviterEmail: 'owner@example.com' },
      'pt-BR',
      LINKS,
      SUPPORT,
    );

    expect(email.html).toContain(
      `Para perguntar qualquer coisa ao Pyxis, escreva para ${SUPPORT}.`,
    );
    expect(email.text).not.toContain('responda a este e-mail');
  });

  it('keeps the larger plan line of a paid quota notice in the body, next to the footer line', () => {
    const email = buildQuotaNoticeEmail(
      {
        kind: 'quota_paused',
        plan: 'paid',
        events: 150_412,
        limit: 100_000,
        month: '2026-10',
        measuredAt: new Date('2026-10-14T03:00:00.000Z'),
        resumesAt: new Date('2026-11-01T00:00:00.000Z'),
      },
      'en',
      LINKS,
      SUPPORT,
    );

    expect(email.html).toContain(
      `To talk about a larger plan, reply to this e-mail or write to ${SUPPORT}.`,
    );
    expect(email.html).toContain(`To ask anything, reply to this e-mail or write to ${SUPPORT}.`);
  });

  it('writes the sentence in every language, both ways, with the address and within the text width', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const way of ['reply', 'write'] as const) {
        const sentence = supportSentence(language, SUPPORT, way);

        expect(sentence).toBe(SUPPORT_LINES[language][way](SUPPORT));
        expect(sentence).toContain(SUPPORT);
      }
      const text = buildWelcomeEmail(
        { plan: { kind: 'subscription' }, terms: null },
        language,
        LINKS,
        SUPPORT,
      ).text;
      expect(Math.max(...text.split('\n').map((line) => line.length))).toBeLessThanOrEqual(
        TEXT_LINE_WIDTH,
      );
    }
  });

  it('has no sentence without an address', () => {
    expect(supportSentence('en', null)).toBeNull();
  });
});
