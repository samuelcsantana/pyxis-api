import type { EmailLanguage } from '../../domain/auth/email-language';
import type { NoticeText } from '../../domain/notices/operator-notice';
import { ACCOUNT_NOTICE_EMAIL_MESSAGES } from './account-notice-email-messages';
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

const BODY: TextBlock = { tone: 'ink', size: 'body', margin: '16px 0 0 0' };
const FOOTNOTE: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };

export function buildOperatorNoticeEmail(
  notice: NoticeText,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  const messages = ACCOUNT_NOTICE_EMAIL_MESSAGES[language];
  const paragraphs = [
    ...notice.paragraphs,
    ...(supportEmail === null ? [] : [messages.support(supportEmail)]),
  ];
  const html = emailDocument({
    language,
    title: notice.subject,
    preheader: notice.paragraphs.join(' '),
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...cardRow([
        heading(notice.subject),
        ...paragraphs.map((line) => paragraph(BODY, escapeHtml(line))),
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
  const text = [
    ...wrapped(notice.subject),
    ...paragraphs.flatMap((line) => ['', ...wrapped(line)]),
    '',
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
  return { subject: notice.subject, html, text };
}
