import type { ProjectAlert } from '../../domain/alerts/project-alert';
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
import {
  PROJECT_ALERT_EMAIL_MESSAGES,
  type ProjectAlertEmailMessages,
} from './project-alert-email-messages';
import { supportFootnote, supportSentence, supportTextLines } from './support-line';
import { INTL_LOCALES, plainSpaces } from './weekly-digest-email';

const KICKER: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 4px 0' };
const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
const WHITESPACE_RUNS = /\s+/g;

const SCREEN_OF_KIND: Readonly<Record<ProjectAlert['kind'], string>> = {
  no_events: 'install',
  failed_writes: 'requests',
  conversion_drop: 'overview',
};

interface AlertText {
  readonly subject: string;
  readonly heading: string;
  readonly body: string;
  readonly hint: string;
  readonly button: string;
  readonly turnOff: string;
}

interface Formats {
  readonly number: (value: number) => string;
  readonly rate: (value: number) => string;
  readonly day: (isoDate: string) => string;
  readonly moment: (at: Date, timeZone: string) => string;
}

function formatsFor(language: EmailLanguage): Formats {
  const locale = INTL_LOCALES[language];
  const numbers = new Intl.NumberFormat(locale);
  const rates = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const days = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return {
    number: (value) => numbers.format(value),
    rate: (value) => plainSpaces(rates.format(value)),
    day: (isoDate) => days.format(new Date(`${isoDate}T00:00:00.000Z`)),
    moment: (at, timeZone) =>
      plainSpaces(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone,
        }).format(at),
      ),
  };
}

function projectNameOf(alert: ProjectAlert): string {
  return alert.projectName.replace(WHITESPACE_RUNS, ' ').trim();
}

function textOf(
  alert: ProjectAlert,
  messages: ProjectAlertEmailMessages,
  formats: Formats,
): AlertText {
  const project = projectNameOf(alert);
  switch (alert.kind) {
    case 'no_events': {
      const copy = messages.noEvents;
      return {
        ...copy,
        subject: copy.subject(project),
        body: copy.body(
          project,
          `${formats.moment(alert.lastEventAt, alert.timeZone)} (${alert.timeZone})`,
          formats.number(alert.visitsBefore),
        ),
      };
    }
    case 'failed_writes': {
      const copy = messages.failedWrites;
      const day = formats.day(alert.day);
      return {
        ...copy,
        subject: copy.subject(project, formats.number(alert.failed), day),
        body: copy.body(
          day,
          formats.number(alert.failed),
          formats.number(alert.total),
          formats.rate(alert.failed / alert.total),
          formats.rate(alert.usualRate),
        ),
      };
    }
    case 'conversion_drop': {
      const copy = messages.conversionDrop;
      const day = formats.day(alert.day);
      return {
        ...copy,
        subject: copy.subject(project, alert.goalName, day),
        body: copy.body(
          alert.goalName,
          day,
          formats.number(alert.conversions),
          formats.day(alert.comparedDay),
          formats.number(alert.comparedConversions),
        ),
      };
    }
  }
}

function projectUrl(alert: ProjectAlert, links: EmailLinks, screen: string): string {
  return `${links.dashboardUrl}${encodeURIComponent(alert.projectId)}/${screen}`;
}

function buildHtml(
  alert: ProjectAlert,
  text: AlertText,
  messages: ProjectAlertEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return emailDocument({
    language: messages.language,
    title: text.subject,
    preheader: text.body,
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        paragraph(KICKER, escapeHtml(`${messages.kicker} · ${projectNameOf(alert)}`)),
        heading(text.heading),
        paragraph(BODY, escapeHtml(text.body)),
        paragraph(BODY, escapeHtml(text.hint)),
        ...actionButton(projectUrl(alert, links, SCREEN_OF_KIND[alert.kind]), text.button),
      ]),
      '<tr>',
      '<td style="padding:24px 8px 0 8px;">',
      ...supportFootnote(support, FOOTNOTE),
      paragraph(FOOTNOTE, escapeHtml(messages.reason(projectNameOf(alert)))),
      paragraph(
        FOOTNOTE,
        `${escapeHtml(text.turnOff)} ${inkLink(projectUrl(alert, links, 'settings'), messages.settings)}.`,
      ),
      paragraph({ ...FOOTNOTE, margin: '0' }, escapeHtml(messages.about)),
      '</td>',
      '</tr>',
    ],
    darkRules: [],
  });
}

function buildText(
  alert: ProjectAlert,
  text: AlertText,
  messages: ProjectAlertEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return [
    `${messages.kicker}: ${projectNameOf(alert)}`,
    '',
    text.heading,
    '',
    ...wrapped(text.body),
    '',
    ...wrapped(text.hint),
    '',
    `${text.button}:`,
    projectUrl(alert, links, SCREEN_OF_KIND[alert.kind]),
    '',
    ...supportTextLines(support),
    ...wrapped(messages.reason(projectNameOf(alert))),
    ...wrapped(`${text.turnOff} ${messages.settings}:`),
    projectUrl(alert, links, 'settings'),
    ...wrapped(messages.about),
  ].join('\n');
}

export function buildProjectAlertEmail(
  alert: ProjectAlert,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = PROJECT_ALERT_EMAIL_MESSAGES[language];
  const text = textOf(alert, messages, formatsFor(language));
  const support = supportSentence(language, supportEmail);
  return {
    subject: text.subject,
    html: buildHtml(alert, text, messages, links, support),
    text: buildText(alert, text, messages, links, support),
  };
}
