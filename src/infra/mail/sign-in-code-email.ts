import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_TTL_MS } from '../../domain/auth/sign-in-code';
import {
  brandHeader,
  cardRow,
  DARK,
  type EmailContent,
  type EmailLinks,
  emailDocument,
  heading,
  inkLink,
  LAYOUT_TABLE,
  LIGHT,
  MONO_FONTS,
  paragraph,
  type TextBlock,
  wrapped,
} from './email-layout';
import { escapeHtml } from './escape-html';
import { supportFootnote, supportSentence, supportTextLines } from './support-line';
import { SIGN_UP_CODE_EMAIL_MESSAGES } from './sign-up-code-email-messages';
import {
  SIGN_IN_CODE_EMAIL_MESSAGES,
  type SignInCodeEmailMessages,
} from './sign-in-code-email-messages';

const MILLISECONDS_PER_MINUTE = 60_000;
const CODE_LIFETIME_MINUTES = SIGN_IN_CODE_TTL_MS / MILLISECONDS_PER_MINUTE;
const TEXT_CODE_INDENT = '    ';

const CODE_DARK_RULES = [
  `.pyxis-code{background-color:${DARK.code}!important;color:${DARK.ink}!important;}`,
];

function codeBlock(code: string): readonly string[] {
  const style =
    `background-color:${LIGHT.code};border-radius:8px;padding:20px 12px 20px 18px;` +
    `font-family:${MONO_FONTS};font-size:36px;line-height:44px;font-weight:700;` +
    `letter-spacing:6px;color:${LIGHT.ink};`;
  return [
    `<table ${LAYOUT_TABLE} width="100%">`,
    '<tr>',
    `<td class="pyxis-code" align="center" style="${style}">${escapeHtml(code)}</td>`,
    '</tr>',
    '</table>',
  ];
}

function card(code: string, messages: SignInCodeEmailMessages): readonly string[] {
  return cardRow([
    heading(messages.heading),
    paragraph(
      { tone: 'muted', size: 'body', margin: '0 0 24px 0' },
      escapeHtml(messages.instruction),
    ),
    ...codeBlock(code),
    paragraph(
      { tone: 'ink', size: 'body', margin: '24px 0 0 0' },
      escapeHtml(messages.expiry(CODE_LIFETIME_MINUTES)),
    ),
    paragraph(
      { tone: 'muted', size: 'body', margin: '16px 0 0 0' },
      escapeHtml(messages.neverShare),
    ),
    paragraph(
      { tone: 'muted', size: 'body', margin: '8px 0 0 0' },
      escapeHtml(messages.notRequested),
    ),
  ]);
}

function footer(
  messages: SignInCodeEmailMessages,
  links: EmailLinks,
  support: string | null,
): readonly string[] {
  const footnote: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
  return [
    '<tr>',
    '<td style="padding:24px 8px 0 8px;">',
    ...supportFootnote(support, footnote),
    paragraph(footnote, escapeHtml(messages.about)),
    paragraph(footnote, escapeHtml(messages.reason)),
    paragraph(
      { ...footnote, margin: '0' },
      `${escapeHtml(messages.dashboard)}: ${inkLink(links.dashboardUrl, links.dashboardHost)}`,
    ),
    '</td>',
    '</tr>',
  ];
}

function buildHtml(
  code: string,
  messages: SignInCodeEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return emailDocument({
    language: messages.language,
    title: messages.subject(code),
    preheader: messages.preheader(code, CODE_LIFETIME_MINUTES),
    rows: [
      ...brandHeader(messages.logoAlt, links),
      ...card(code, messages),
      ...footer(messages, links, support),
    ],
    darkRules: CODE_DARK_RULES,
  });
}

function buildText(
  code: string,
  messages: SignInCodeEmailMessages,
  links: EmailLinks,
  support: string | null,
): string {
  return [
    messages.heading,
    '',
    ...wrapped(messages.instruction),
    '',
    `${TEXT_CODE_INDENT}${code}`,
    '',
    ...wrapped(messages.expiry(CODE_LIFETIME_MINUTES)),
    '',
    ...wrapped(messages.neverShare),
    ...wrapped(messages.notRequested),
    '',
    ...supportTextLines(support),
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${links.dashboardUrl}`,
  ].join('\n');
}

export function renderSignInCodeEmail(
  code: string,
  messages: SignInCodeEmailMessages,
  links: EmailLinks,
  support: string | null,
): EmailContent {
  return {
    subject: messages.subject(code),
    html: buildHtml(code, messages, links, support),
    text: buildText(code, messages, links, support),
  };
}

export function buildSignUpCodeEmail(
  code: string,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  return renderSignInCodeEmail(
    code,
    SIGN_UP_CODE_EMAIL_MESSAGES[language],
    links,
    supportSentence(language, supportEmail),
  );
}

export function buildSignInCodeEmail(
  code: string,
  language: EmailLanguage,
  links: EmailLinks,
  supportEmail: string | null,
): EmailContent {
  return renderSignInCodeEmail(
    code,
    SIGN_IN_CODE_EMAIL_MESSAGES[language],
    links,
    supportSentence(language, supportEmail),
  );
}
