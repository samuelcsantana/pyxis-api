import type { SubscriptionConfirmation } from '../../domain/accounts/subscription-confirmation';
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
import { SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES } from './subscription-confirmed-email-messages';
import { supportFootnote, supportSentence, supportTextLines } from './support-line';
import { WELCOME_EMAIL_MESSAGES } from './welcome-email-messages';

const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };

interface ConfirmationText {
  readonly paragraphs: readonly string[];
  readonly terms: string | null;
}

function textOf(confirmation: SubscriptionConfirmation, language: EmailLanguage): ConfirmationText {
  const messages = SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES[language];
  const welcome = WELCOME_EMAIL_MESSAGES[language];
  return {
    paragraphs: [
      messages.confirmed(
        confirmation.interval === null ? null : messages.intervals[confirmation.interval],
      ),
      messages.withdrawal(confirmation.withdrawalDays),
      messages.manage,
    ],
    terms: confirmation.terms === null ? null : welcome.terms(confirmation.terms),
  };
}

function buildHtml(
  text: ConfirmationText,
  language: EmailLanguage,
  links: EmailLinks,
  support: string | null,
): string {
  const messages = SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES[language];
  const welcome = WELCOME_EMAIL_MESSAGES[language];
  return emailDocument({
    language,
    title: messages.subject,
    preheader: messages.preheader,
    rows: [
      ...brandHeader(welcome.logoAlt, links),
      ...cardRow([
        heading(messages.heading),
        ...text.paragraphs.map((line) => paragraph(BODY, escapeHtml(line))),
        ...actionButton(links.dashboardUrl, welcome.openDashboard),
        ...(text.terms === null
          ? []
          : [paragraph({ ...FOOTNOTE, margin: '24px 0 0 0' }, escapeHtml(text.terms))]),
      ]),
      '<tr>',
      '<td style="padding:24px 8px 0 8px;">',
      ...supportFootnote(support, FOOTNOTE),
      paragraph(FOOTNOTE, escapeHtml(welcome.about)),
      paragraph(FOOTNOTE, escapeHtml(welcome.reason)),
      paragraph(
        { ...FOOTNOTE, margin: '0' },
        `${escapeHtml(welcome.dashboard)}: ${inkLink(links.dashboardUrl, links.dashboardHost)}`,
      ),
      '</td>',
      '</tr>',
    ],
    darkRules: [],
  });
}

function buildText(
  text: ConfirmationText,
  language: EmailLanguage,
  links: EmailLinks,
  support: string | null,
): string {
  const messages = SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES[language];
  const welcome = WELCOME_EMAIL_MESSAGES[language];
  return [
    messages.heading,
    ...text.paragraphs.flatMap((line) => ['', ...wrapped(line)]),
    '',
    `${welcome.openDashboard}: ${links.dashboardUrl}`,
    ...(text.terms === null ? [] : ['', ...wrapped(text.terms)]),
    '',
    ...supportTextLines(support),
    ...wrapped(welcome.about),
    ...wrapped(welcome.reason),
    `${welcome.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildSubscriptionConfirmedEmail(
  confirmation: SubscriptionConfirmation,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const text = textOf(confirmation, language);
  const support = supportSentence(language, supportEmail);
  return {
    subject: SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES[language].subject,
    html: buildHtml(text, language, links, support),
    text: buildText(text, language, links, support),
  };
}
