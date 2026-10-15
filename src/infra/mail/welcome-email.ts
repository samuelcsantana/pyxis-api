import type { Welcome } from '../../domain/accounts/welcome';
import type { EmailLanguage } from '../../domain/auth/email-language';
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
import { WELCOME_EMAIL_MESSAGES, type WelcomeEmailMessages } from './welcome-email-messages';

const INTL_LOCALES: Readonly<Record<EmailLanguage, string>> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es',
};
const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };

interface WelcomeText {
  readonly preheader: string;
  readonly paragraphs: readonly string[];
  readonly terms: string | null;
}

function textOf(welcome: Welcome, messages: WelcomeEmailMessages): WelcomeText {
  const terms = welcome.terms === null ? null : messages.terms(welcome.terms);
  if (welcome.trialEndsAt === null) {
    return {
      preheader: messages.activePreheader,
      paragraphs: [messages.activeConfirmed, messages.nextStep],
      terms,
    };
  }
  const day = new Intl.DateTimeFormat(INTL_LOCALES[messages.language], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(welcome.trialEndsAt);
  return {
    preheader: messages.trialPreheader(day),
    paragraphs: [messages.trialConfirmed(day), messages.nextStep],
    terms,
  };
}

function buildHtml(text: WelcomeText, messages: WelcomeEmailMessages, links: EmailLinks): string {
  return emailDocument({
    language: messages.language,
    title: messages.subject,
    preheader: text.preheader,
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(messages.heading),
        ...text.paragraphs.map((line) => paragraph(BODY, escapeHtml(line))),
        ...actionButton(links.dashboardUrl, messages.openDashboard),
        ...(text.terms === null
          ? []
          : [paragraph({ ...FOOTNOTE, margin: '24px 0 0 0' }, escapeHtml(text.terms))]),
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

function buildText(text: WelcomeText, messages: WelcomeEmailMessages, links: EmailLinks): string {
  return [
    messages.heading,
    ...text.paragraphs.flatMap((line) => ['', ...wrapped(line)]),
    '',
    `${messages.openDashboard}: ${links.dashboardUrl}`,
    ...(text.terms === null ? [] : ['', ...wrapped(text.terms)]),
    '',
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildWelcomeEmail(
  welcome: Welcome,
  language: EmailLanguage,
  links: EmailLinks,
): EmailContent {
  const messages = WELCOME_EMAIL_MESSAGES[language];
  const text = textOf(welcome, messages);
  return {
    subject: messages.subject,
    html: buildHtml(text, messages, links),
    text: buildText(text, messages, links),
  };
}
