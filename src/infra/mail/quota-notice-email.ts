import type { QuotaNotice } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { usageMonth } from '../../domain/queries/project-usage';
import {
  brandHeader,
  cardRow,
  type EmailContent,
  type EmailLinks,
  emailDocument,
  heading,
  inkLink,
  paragraph,
  type TextBlock,
  wrapped,
} from './email-layout';
import { escapeHtml } from './escape-html';
import {
  QUOTA_NOTICE_EMAIL_MESSAGES,
  type QuotaNoticeEmailMessages,
  type QuotaPausedWords,
  type QuotaWarningWords,
} from './quota-notice-email-messages';

const INTL_LOCALES: Readonly<Record<EmailLanguage, string>> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es',
  de: 'de',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
};
const PERCENT = 100;

interface QuotaNoticeCopy {
  readonly subject: string;
  readonly preheader: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

function formatters(language: EmailLanguage) {
  const locale = INTL_LOCALES[language];
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  return {
    count: (value: number) => number.format(value),
    percent: (value: number) => percent.format(value / PERCENT),
    day: (value: Date) => day.format(value),
    month: (label: string) => month.format(usageMonth(label).from),
  };
}

function copyOf(
  notice: QuotaNotice,
  messages: QuotaNoticeEmailMessages,
  supportEmail: string | null,
): QuotaNoticeCopy {
  const format = formatters(messages.language);
  const support = supportEmail === null ? [] : [messages.support(supportEmail)];
  const shared = {
    events: format.count(notice.events),
    limit: format.count(notice.limit),
    month: format.month(notice.month),
  };
  if (notice.kind === 'quota_paused') {
    const words: QuotaPausedWords = { ...shared, resumesOn: format.day(notice.resumesAt) };
    return {
      subject: messages.pausedSubject(words),
      preheader: messages.pausedPreheader(words),
      heading: messages.pausedHeading,
      paragraphs: [messages.pausedCount(words), messages.pausedEffect(words), ...support],
    };
  }
  const words: QuotaWarningWords = {
    ...shared,
    percent: format.percent(notice.percent),
    measuredOn: format.day(notice.measuredAt),
  };
  const pause =
    notice.pause === null
      ? []
      : [
          messages.warningPause({
            pauseAtEvents: format.count(notice.pause.atEvents),
            pauseUntil: format.day(notice.pause.until),
          }),
        ];
  return {
    subject: messages.warningSubject(words),
    preheader: messages.warningPreheader(words),
    heading: messages.warningHeading(words),
    paragraphs: [
      messages.warningCount(words),
      messages.warningCarriesOn[notice.percent],
      ...pause,
      ...support,
    ],
  };
}

function buildHtml(
  copy: QuotaNoticeCopy,
  messages: QuotaNoticeEmailMessages,
  links: EmailLinks,
): string {
  const body: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
  const footnote: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
  return emailDocument({
    language: messages.language,
    title: copy.subject,
    preheader: copy.preheader,
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(copy.heading),
        ...copy.paragraphs.map((text) => paragraph(body, escapeHtml(text))),
      ]),
      '<tr>',
      '<td style="padding:24px 8px 0 8px;">',
      paragraph(footnote, escapeHtml(messages.about)),
      paragraph(footnote, escapeHtml(messages.reason)),
      paragraph(
        { ...footnote, margin: '0' },
        `${escapeHtml(messages.dashboard)}: ${inkLink(links.dashboardUrl, links.dashboardHost)}`,
      ),
      '</td>',
      '</tr>',
    ],
    darkRules: [],
  });
}

function buildText(
  copy: QuotaNoticeCopy,
  messages: QuotaNoticeEmailMessages,
  links: EmailLinks,
): string {
  return [
    copy.heading,
    ...copy.paragraphs.flatMap((text) => ['', ...wrapped(text)]),
    '',
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildQuotaNoticeEmail(
  notice: QuotaNotice,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = QUOTA_NOTICE_EMAIL_MESSAGES[language];
  const copy = copyOf(notice, messages, supportEmail);
  return {
    subject: copy.subject,
    html: buildHtml(copy, messages, links),
    text: buildText(copy, messages, links),
  };
}
