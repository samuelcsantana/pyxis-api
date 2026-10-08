import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_TTL_MS } from '../../domain/auth/sign-in-code';
import { escapeHtml } from './escape-html';
import {
  SIGN_IN_CODE_EMAIL_MESSAGES,
  type SignInCodeEmailMessages,
} from './sign-in-code-email-messages';
import { wrapText } from './wrap-text';

export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const DASHBOARD_URL = 'https://pyxis.samuelsantana.dev/';
export const EMAIL_LOGO_URL = `${DASHBOARD_URL}email/pyxis-logo.png`;
export const EMAIL_LOGO_2X_URL = `${DASHBOARD_URL}email/pyxis-logo@2x.png`;
export const TEXT_LINE_WIDTH = 72;

const DASHBOARD_HOST = new URL(DASHBOARD_URL).host;
const MILLISECONDS_PER_MINUTE = 60_000;
const CODE_LIFETIME_MINUTES = SIGN_IN_CODE_TTL_MS / MILLISECONDS_PER_MINUTE;
const CONTENT_WIDTH_PX = 560;
const LOGO_SIZE_PX = 40;
const PREHEADER_FILLER_REPEAT = 20;
const PREHEADER_FILLER = '&#847;&zwnj;&nbsp;'.repeat(PREHEADER_FILLER_REPEAT);
const TEXT_CODE_INDENT = '    ';

const SANS_FONTS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_FONTS = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const LIGHT = {
  page: '#f4f6fa',
  card: '#ffffff',
  line: '#e3e8f0',
  ink: '#0e1a2b',
  muted: '#5b6b82',
  code: '#eef2f8',
} as const;

const DARK = {
  page: '#0a1220',
  card: '#101c2e',
  line: '#1e2d45',
  ink: '#e6edf7',
  muted: '#93a3ba',
  code: '#16243a',
} as const;

const LAYOUT_TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';
const PREHEADER_STYLE =
  'display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;' +
  'font-size:1px;line-height:1px;color:transparent;';

const TONES = {
  ink: { className: 'pyxis-ink', color: LIGHT.ink },
  muted: { className: 'pyxis-muted', color: LIGHT.muted },
} as const;

const TEXT_SIZES = {
  body: 'font-size:15px;line-height:22px;',
  small: 'font-size:13px;line-height:20px;',
} as const;

const STYLE_BLOCK = [
  '<style>',
  ':root{color-scheme:light dark;supported-color-schemes:light dark;}',
  '@media (prefers-color-scheme:dark){',
  `.pyxis-page{background-color:${DARK.page}!important;}`,
  `.pyxis-card{background-color:${DARK.card}!important;border-color:${DARK.line}!important;}`,
  `.pyxis-ink{color:${DARK.ink}!important;}`,
  `.pyxis-muted{color:${DARK.muted}!important;}`,
  `.pyxis-code{background-color:${DARK.code}!important;color:${DARK.ink}!important;}`,
  '}',
  '</style>',
];

interface TextBlock {
  readonly tone: keyof typeof TONES;
  readonly size: keyof typeof TEXT_SIZES;
  readonly margin: string;
}

function paragraph({ tone, size, margin }: TextBlock, content: string): string {
  const { className, color } = TONES[tone];
  const style = `margin:${margin};font-family:${SANS_FONTS};${TEXT_SIZES[size]}color:${color};`;
  return `<p class="${className}" style="${style}">${content}</p>`;
}

function header(messages: SignInCodeEmailMessages): readonly string[] {
  const logo =
    `<img src="${escapeHtml(EMAIL_LOGO_URL)}" srcset="${escapeHtml(EMAIL_LOGO_2X_URL)} 2x" ` +
    `width="${String(LOGO_SIZE_PX)}" height="${String(LOGO_SIZE_PX)}" ` +
    `alt="${escapeHtml(messages.logoAlt)}" style="display:block;border:0;outline:none;">`;
  const wordmarkStyle =
    `padding-left:12px;vertical-align:middle;font-family:${SANS_FONTS};font-size:22px;` +
    `line-height:28px;font-weight:700;letter-spacing:-0.02em;color:${LIGHT.ink};`;
  return [
    '<tr>',
    '<td style="padding:0 0 20px 0;">',
    `<table ${LAYOUT_TABLE}>`,
    '<tr>',
    `<td style="vertical-align:middle;">${logo}</td>`,
    `<td class="pyxis-ink" style="${wordmarkStyle}">Pyxis</td>`,
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
  ];
}

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
  const cardStyle = `background-color:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:12px;padding:32px;`;
  const headingStyle =
    `margin:0 0 8px 0;font-family:${SANS_FONTS};font-size:20px;line-height:28px;` +
    `font-weight:600;color:${LIGHT.ink};`;
  return [
    '<tr>',
    `<td class="pyxis-card" style="${cardStyle}">`,
    `<h1 class="pyxis-ink" style="${headingStyle}">${escapeHtml(messages.heading)}</h1>`,
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
    '</td>',
    '</tr>',
  ];
}

function footer(messages: SignInCodeEmailMessages): readonly string[] {
  const footnote: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
  const link =
    `<a class="pyxis-ink" href="${escapeHtml(DASHBOARD_URL)}" ` +
    `style="color:${LIGHT.ink};text-decoration:underline;">${escapeHtml(DASHBOARD_HOST)}</a>`;
  return [
    '<tr>',
    '<td style="padding:24px 8px 0 8px;">',
    paragraph(footnote, escapeHtml(messages.about)),
    paragraph(footnote, escapeHtml(messages.reason)),
    paragraph({ ...footnote, margin: '0' }, `${escapeHtml(messages.dashboard)}: ${link}`),
    '</td>',
    '</tr>',
  ];
}

function buildHtml(code: string, messages: SignInCodeEmailMessages): string {
  const preheader = escapeHtml(messages.preheader(code, CODE_LIFETIME_MINUTES));
  const contentTableStyle = `width:100%;max-width:${String(CONTENT_WIDTH_PX)}px;`;
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(messages.language)}" dir="ltr">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="supported-color-schemes" content="light dark">',
    `<title>${escapeHtml(messages.subject(code))}</title>`,
    ...STYLE_BLOCK,
    '</head>',
    `<body class="pyxis-page" style="margin:0;padding:0;background-color:${LIGHT.page};">`,
    `<div style="${PREHEADER_STYLE}">${preheader}`,
    `${PREHEADER_FILLER}</div>`,
    `<table ${LAYOUT_TABLE} width="100%" class="pyxis-page" ` +
      `style="background-color:${LIGHT.page};">`,
    '<tr>',
    '<td align="center" style="padding:32px 16px;">',
    `<table ${LAYOUT_TABLE} width="${String(CONTENT_WIDTH_PX)}" style="${contentTableStyle}">`,
    ...header(messages),
    ...card(code, messages),
    ...footer(messages),
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

function wrapped(paragraphText: string): readonly string[] {
  return wrapText(paragraphText, TEXT_LINE_WIDTH);
}

function buildText(code: string, messages: SignInCodeEmailMessages): string {
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
    ...wrapped(messages.about),
    ...wrapped(messages.reason),
    `${messages.dashboard}: ${DASHBOARD_URL}`,
  ].join('\n');
}

export function renderSignInCodeEmail(
  code: string,
  messages: SignInCodeEmailMessages,
): EmailContent {
  return {
    subject: messages.subject(code),
    html: buildHtml(code, messages),
    text: buildText(code, messages),
  };
}

export function buildSignInCodeEmail(code: string, language: EmailLanguage): EmailContent {
  return renderSignInCodeEmail(code, SIGN_IN_CODE_EMAIL_MESSAGES[language]);
}
