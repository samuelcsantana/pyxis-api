import type { EmailLanguage } from '../../domain/auth/email-language';
import type { Invitation } from '../../domain/people/invitation';
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
  INVITATION_EMAIL_MESSAGES,
  type InvitationEmailMessages,
  type InvitationWords,
} from './invitation-email-messages';

const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
const WHITESPACE_RUNS = /\s+/g;

function singleLine(text: string): string {
  return text.replace(WHITESPACE_RUNS, ' ').trim();
}

function buildHtml(
  words: InvitationWords,
  messages: InvitationEmailMessages,
  links: EmailLinks,
): string {
  return emailDocument({
    language: messages.language,
    title: messages.subject(words),
    preheader: messages.preheader(words),
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(messages.heading(words)),
        paragraph(BODY, escapeHtml(messages.added(words))),
        paragraph(BODY, escapeHtml(messages.howToSignIn)),
        ...actionButton(links.dashboardUrl, messages.openDashboard),
        paragraph({ ...FOOTNOTE, margin: '24px 0 0 0' }, escapeHtml(messages.notExpected)),
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
  words: InvitationWords,
  messages: InvitationEmailMessages,
  links: EmailLinks,
): string {
  return [
    ...wrapped(messages.heading(words)),
    '',
    ...wrapped(messages.added(words)),
    '',
    ...wrapped(messages.howToSignIn),
    '',
    `${messages.openDashboard}: ${links.dashboardUrl}`,
    '',
    ...wrapped(messages.notExpected),
    '',
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function buildInvitationEmail(
  invitation: Invitation,
  language: EmailLanguage,
  links: EmailLinks,
): EmailContent {
  const messages = INVITATION_EMAIL_MESSAGES[language];
  const words: InvitationWords = {
    project: singleLine(invitation.projectName),
    inviter: singleLine(invitation.inviterEmail),
  };
  return {
    subject: messages.subject(words),
    html: buildHtml(words, messages, links),
    text: buildText(words, messages, links),
  };
}
