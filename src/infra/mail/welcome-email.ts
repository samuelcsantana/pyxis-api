import type { Welcome, WelcomePlan } from '../../domain/accounts/welcome';
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
  de: 'de',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
};
const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };

interface WelcomeText {
  readonly preheader: string;
  readonly paragraphs: readonly string[];
  readonly terms: string | null;
  readonly reason: string;
}

function planText(
  plan: WelcomePlan,
  messages: WelcomeEmailMessages,
): Pick<WelcomeText, 'preheader' | 'paragraphs' | 'reason'> {
  const intlLocale = INTL_LOCALES[messages.language];
  switch (plan.kind) {
    case 'subscription':
      return {
        preheader: messages.activePreheader,
        paragraphs: [messages.activeConfirmed, messages.nextStep],
        reason: messages.reason,
      };
    case 'trial': {
      const day = new Intl.DateTimeFormat(intlLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(plan.trialEndsAt);
      return {
        preheader: messages.trialPreheader(day),
        paragraphs: [messages.trialConfirmed(day), messages.nextStep],
        reason: messages.reason,
      };
    }
    case 'free': {
      const count = new Intl.NumberFormat(intlLocale);
      return {
        preheader: messages.freePreheader,
        paragraphs: [
          messages.freeConfirmed({
            events: count.format(plan.limits.eventsPerMonth),
            projects: plan.limits.projects,
            people: plan.limits.people,
            pauseAt: count.format(plan.pauseAtEvents),
          }),
          messages.nextStep,
          messages.freeInactivity,
        ],
        reason: messages.freeReason,
      };
    }
  }
}

function textOf(welcome: Welcome, messages: WelcomeEmailMessages): WelcomeText {
  return {
    ...planText(welcome.plan, messages),
    terms: welcome.terms === null ? null : messages.terms(welcome.terms),
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
      paragraph(FOOTNOTE, escapeHtml(text.reason)),
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
    ...wrapped(text.reason),
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
