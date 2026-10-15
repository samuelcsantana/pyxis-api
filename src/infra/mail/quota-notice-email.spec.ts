import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildQuotaNoticeEmail } from './quota-notice-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const SUPPORT = 'hello@example.com';
const MEASURED_AT = new Date('2026-10-14T03:00:00.000Z');
const NOVEMBER_FIRST = new Date('2026-11-01T00:00:00.000Z');

function warning(
  percent: 80 | 100,
  events: number,
): Extract<QuotaNotice, { kind: 'quota_warning' }> {
  return {
    kind: 'quota_warning',
    percent,
    events,
    limit: 100_000,
    month: '2026-10',
    measuredAt: MEASURED_AT,
    pause: { atEvents: 150_000, until: NOVEMBER_FIRST },
  };
}

const PAUSED: QuotaNotice = {
  kind: 'quota_paused',
  events: 150_412,
  limit: 100_000,
  month: '2026-10',
  measuredAt: MEASURED_AT,
  resumesAt: NOVEMBER_FIRST,
};

function flowing(content: string): string {
  return content.replace(/\s+/g, ' ');
}

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildQuotaNoticeEmail in English', () => {
  it('says how much of the month was used, that nothing changes yet and when it would pause', () => {
    const email = buildQuotaNoticeEmail(warning(80, 82_345), 'en', LINKS, SUPPORT);

    expect(email.subject).toBe('Your Pyxis account used 80% of October’s events');
    expect(flowing(email.text)).toContain(
      'Your account received 82,345 of its 100,000 events in October, counted on October 14.',
    );
    expect(email.text).toContain('Nothing changes yet');
    expect(flowing(email.text)).toContain('150,000 events');
    expect(flowing(email.text)).toContain('until November 1');
    expect(email.html).toContain('Nothing changes yet');
  });

  it('says nothing is cut off at 100%', () => {
    const email = buildQuotaNoticeEmail(warning(100, 101_000), 'en', LINKS, SUPPORT);

    expect(email.subject).toBe('Your Pyxis account used 100% of October’s events');
    expect(email.text).toContain('Nothing is cut off');
  });

  it('says nothing about a pause to an account exempt from it', () => {
    const email = buildQuotaNoticeEmail(
      { ...warning(100, 160_000), pause: null },
      'en',
      LINKS,
      SUPPORT,
    );

    expect(email.text).toContain('Nothing is cut off');
    expect(flowing(email.text)).not.toContain('150,000 events');
    expect(email.html).not.toContain('pauses until');
  });

  it('says measuring is paused, until when, and that it resumes on its own', () => {
    const email = buildQuotaNoticeEmail(PAUSED, 'en', LINKS, SUPPORT);

    expect(email.subject).toBe('Pyxis paused measuring your sites until November 1');
    expect(email.text).toContain('Measuring is paused');
    expect(flowing(email.text)).toContain('150,412 events in October');
    expect(flowing(email.text)).toContain('Measuring resumes on its own then.');
  });

  it('names the support address only when one is set', () => {
    expect(buildQuotaNoticeEmail(PAUSED, 'en', LINKS, SUPPORT).text).toContain(SUPPORT);
    expect(buildQuotaNoticeEmail(PAUSED, 'en', LINKS, null).text).not.toContain('larger plan');
  });

  it('keeps the plain text within the line width and links the dashboard', () => {
    const email = buildQuotaNoticeEmail(warning(80, 82_345), 'en', LINKS, SUPPORT);

    expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
    expect(email.text).toContain('Dashboard: https://dashboard.example.com/');
    expect(email.html).toContain('href="https://dashboard.example.com/"');
  });
});

describe('buildQuotaNoticeEmail in Portuguese and Spanish', () => {
  it('writes the numbers, months and dates of the language', () => {
    const portuguese = buildQuotaNoticeEmail(warning(80, 82_345), 'pt-BR', LINKS, SUPPORT);
    const spanish = buildQuotaNoticeEmail(warning(80, 82_345), 'es', LINKS, SUPPORT);

    expect(portuguese.subject).toBe('Sua conta do Pyxis usou 80% dos eventos de outubro');
    expect(flowing(portuguese.text)).toContain('82.345 dos 100.000 eventos do plano em outubro');
    expect(flowing(portuguese.text)).toContain('até 1 de novembro');
    expect(spanish.subject).toBe('Tu cuenta de Pyxis usó el 80\u00a0% de los eventos de octubre');
    expect(flowing(spanish.text)).toContain('82.345 de sus 100.000 eventos en octubre');
    expect(flowing(spanish.text)).toContain('hasta el 1 de noviembre');
  });

  it.each(EMAIL_LANGUAGES)(
    'declares %s on the page and keeps every notice readable',
    (language) => {
      for (const notice of [warning(80, 82_345), warning(100, 101_000), PAUSED]) {
        const email = buildQuotaNoticeEmail(notice, language, LINKS, SUPPORT);

        expect(email.html).toContain(`<html lang="${language}"`);
        expect(email.subject).not.toBe('');
        expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      }
    },
  );
});
