import type { InstallReminder, ProjectToInstall } from '../../domain/accounts/install-reminder';
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
  INSTALL_REMINDER_EMAIL_MESSAGES,
  type InstallReminderEmailMessages,
  type InstallWay,
} from './install-reminder-email-messages';
import { supportFootnote, supportSentence, supportTextLines } from './support-line';

const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const WAY: TextBlock = { tone: 'ink', size: 'body', margin: '8px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
const WAY_NAME_STYLE = 'font-weight:600;';
const WHITESPACE_RUNS = /\s+/g;
const INSTALL_PATH = 'install';

interface ReminderText {
  readonly subject: string;
  readonly preheader: string;
  readonly heading: string;
  readonly intro: string;
  readonly lead: string;
  readonly button: string;
  readonly buttonUrl: string;
}

export function installPageUrl(project: ProjectToInstall, links: EmailLinks): string {
  return `${links.dashboardUrl}${project.id}/${INSTALL_PATH}`;
}

function textOf(
  reminder: InstallReminder,
  messages: InstallReminderEmailMessages,
  links: EmailLinks,
): ReminderText {
  const { project } = reminder;
  if (project === null) {
    return { ...messages.withoutProject, buttonUrl: links.dashboardUrl };
  }
  const projectName = project.name.replace(WHITESPACE_RUNS, ' ').trim();
  return {
    ...messages.withProject,
    intro: messages.withProject.intro(projectName),
    buttonUrl: installPageUrl(project, links),
  };
}

function wayHtml(way: InstallWay, messages: InstallReminderEmailMessages): string {
  const name = `<strong style="${WAY_NAME_STYLE}">${escapeHtml(way.name)}</strong>`;
  return paragraph(WAY, `${name}${escapeHtml(messages.colon)}${escapeHtml(way.how)}`);
}

function wayText(way: InstallWay, messages: InstallReminderEmailMessages): string {
  return `${way.name}${messages.colon}${way.how}`;
}

function buildHtml(
  text: ReminderText,
  messages: InstallReminderEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return emailDocument({
    language: messages.language,
    title: text.subject,
    preheader: text.preheader,
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(text.heading),
        paragraph(BODY, escapeHtml(text.intro)),
        paragraph(BODY, escapeHtml(text.lead)),
        ...messages.ways.map((way) => wayHtml(way, messages)),
        paragraph(BODY, escapeHtml(messages.closing)),
        ...actionButton(text.buttonUrl, text.button),
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
  text: ReminderText,
  messages: InstallReminderEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return [
    text.heading,
    '',
    ...wrapped(text.intro),
    '',
    ...wrapped(text.lead),
    ...messages.ways.flatMap((way) => ['', ...wrapped(wayText(way, messages))]),
    '',
    ...wrapped(messages.closing),
    '',
    `${text.button}${messages.colon.trimEnd()}`,
    text.buttonUrl,
    '',
    ...supportTextLines(support),
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildInstallReminderEmail(
  reminder: InstallReminder,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = INSTALL_REMINDER_EMAIL_MESSAGES[language];
  const text = textOf(reminder, messages, links);
  const support = supportSentence(language, supportEmail);
  return {
    subject: text.subject,
    html: buildHtml(text, messages, links, support),
    text: buildText(text, messages, links, support),
  };
}
