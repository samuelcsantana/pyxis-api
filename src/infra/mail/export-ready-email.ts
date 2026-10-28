import type { EmailLanguage } from '../../domain/auth/email-language';
import type { ExportReady } from '../../domain/exports/export-ready';
import {
  actionButton,
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
  EXPORT_READY_EMAIL_MESSAGES,
  type ExportReadyEmailMessages,
  type ExportReadyWords,
} from './export-ready-email-messages';
import { supportFootnote, supportSentence, supportTextLines } from './support-line';

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
const WHITESPACE_RUNS = /\s+/g;

export function exportPageUrl(ready: ExportReady, links: EmailLinks): string {
  return `${links.dashboardUrl}${ready.projectId}/exports/${ready.exportId}`;
}

function wordsOf(ready: ExportReady, language: EmailLanguage): ExportReadyWords {
  const locale = INTL_LOCALES[language];
  return {
    project: ready.projectName.replace(WHITESPACE_RUNS, ' ').trim(),
    events: new Intl.NumberFormat(locale).format(ready.eventCount),
    until: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(ready.availableUntil),
  };
}

function buildHtml(
  words: ExportReadyWords,
  messages: ExportReadyEmailMessages,
  pageUrl: string,
  links: EmailLinks,
  support: string | null,
): string {
  return emailDocument({
    language: messages.language,
    title: messages.subject(words),
    preheader: messages.preheader(words),
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(messages.heading),
        paragraph(BODY, escapeHtml(messages.contents(words))),
        paragraph(BODY, escapeHtml(messages.availability(words))),
        ...actionButton(pageUrl, messages.download),
      ]),
      '<tr>',
      '<td style="padding:24px 8px 0 8px;">',
      ...supportFootnote(support, FOOTNOTE),
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
  words: ExportReadyWords,
  messages: ExportReadyEmailMessages,
  pageUrl: string,
  links: EmailLinks,
  support: string | null,
): string {
  return [
    messages.heading,
    '',
    ...wrapped(messages.contents(words)),
    '',
    ...wrapped(messages.availability(words)),
    '',
    `${messages.download}:`,
    pageUrl,
    '',
    ...supportTextLines(support),
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildExportReadyEmail(
  ready: ExportReady,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = EXPORT_READY_EMAIL_MESSAGES[language];
  const support = supportSentence(language, supportEmail);
  const words = wordsOf(ready, language);
  const pageUrl = exportPageUrl(ready, links);
  return {
    subject: messages.subject(words),
    html: buildHtml(words, messages, pageUrl, links, support),
    text: buildText(words, messages, pageUrl, links, support),
  };
}
