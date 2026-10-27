import type { AccountNotice } from '../../domain/accounts/account-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
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
  ACCOUNT_NOTICE_EMAIL_MESSAGES,
  type AccountNoticeEmailMessages,
  type AccountNoticeWords,
  NO_DEADLINE,
  NO_REFUND,
} from './account-notice-email-messages';

const INTL_LOCALES: Readonly<Record<EmailLanguage, string>> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es',
  de: 'de',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
};
const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
const NO_DATE = '';
const REFUND_CURRENCY = 'BRL';
const CENTS_PER_UNIT = 100;
const NO_WORDS: AccountNoticeWords = {
  deletionOn: NO_DATE,
  refunded: NO_REFUND,
  monthlyEvents: '',
  fitBy: NO_DEADLINE,
};

function longDateOf(moment: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(moment);
}

interface NoticeText {
  readonly subject: string;
  readonly preheader: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

function wordsOf(notice: AccountNotice, language: EmailLanguage): AccountNoticeWords {
  const locale = INTL_LOCALES[language];
  switch (notice.kind) {
    case 'account_deleted':
      return NO_WORDS;
    case 'withdrawn_to_free':
      return {
        ...NO_WORDS,
        refunded:
          notice.refundedAmount === 0
            ? NO_REFUND
            : new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: REFUND_CURRENCY,
              }).format(notice.refundedAmount / CENTS_PER_UNIT),
        fitBy: notice.fitBy === null ? NO_DEADLINE : longDateOf(notice.fitBy, locale),
      };
    case 'back_to_free':
      return {
        ...NO_WORDS,
        monthlyEvents: new Intl.NumberFormat(locale).format(notice.eventsPerMonth),
      };
    case 'access_ended':
    case 'deletion_reminder':
      return {
        ...NO_WORDS,
        deletionOn: longDateOf(notice.deletionOn, locale),
      };
  }
}

function textOf(
  notice: AccountNotice,
  messages: AccountNoticeEmailMessages,
  supportEmail: string | null,
): NoticeText {
  const copy = messages.notices[notice.kind];
  const words = wordsOf(notice, messages.language);
  return {
    subject: copy.subject(words),
    preheader: copy.preheader(words),
    heading: copy.heading(words),
    paragraphs: [
      ...copy.paragraphs(words),
      ...(supportEmail === null ? [] : [messages.support(supportEmail)]),
    ],
  };
}

function buildHtml(
  text: NoticeText,
  messages: AccountNoticeEmailMessages,
  links: EmailLinks,
): string {
  return emailDocument({
    language: messages.language,
    title: text.subject,
    preheader: text.preheader,
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(text.heading),
        ...text.paragraphs.map((line) => paragraph(BODY, escapeHtml(line))),
      ]),
      '<tr>',
      '<td style="padding:24px 8px 0 8px;">',
      paragraph(FOOTNOTE, escapeHtml(messages.about)),
      paragraph(FOOTNOTE, escapeHtml(messages.reason)),
      paragraph(
        { ...FOOTNOTE, margin: '0' },
        `${escapeHtml(messages.dashboard)}: ${inkLink(links.dashboardUrl, links.dashboardHost)}`,
      ),
      '</td>',
      '</tr>',
    ],
    darkRules: [],
  });
}

function buildText(
  text: NoticeText,
  messages: AccountNoticeEmailMessages,
  links: EmailLinks,
): string {
  return [
    ...wrapped(text.heading),
    ...text.paragraphs.flatMap((line) => ['', ...wrapped(line)]),
    '',
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildAccountNoticeEmail(
  notice: AccountNotice,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = ACCOUNT_NOTICE_EMAIL_MESSAGES[language];
  const text = textOf(notice, messages, supportEmail);
  return {
    subject: text.subject,
    html: buildHtml(text, messages, links),
    text: buildText(text, messages, links),
  };
}
