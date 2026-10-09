import { escapeHtml } from './escape-html';
import { wrapText } from './wrap-text';

export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const DASHBOARD_URL = 'https://pyxis.samuelsantana.dev/';
export const DASHBOARD_HOST = new URL(DASHBOARD_URL).host;
export const EMAIL_LOGO_URL = `${DASHBOARD_URL}email/pyxis-logo.png`;
export const EMAIL_LOGO_2X_URL = `${DASHBOARD_URL}email/pyxis-logo@2x.png`;
export const TEXT_LINE_WIDTH = 72;

const CONTENT_WIDTH_PX = 560;
const LOGO_SIZE_PX = 40;
const PREHEADER_FILLER_REPEAT = 20;
const PREHEADER_FILLER = '&#847;&zwnj;&nbsp;'.repeat(PREHEADER_FILLER_REPEAT);

export const SANS_FONTS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO_FONTS = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export const LIGHT = {
  page: '#f4f6fa',
  card: '#ffffff',
  line: '#e3e8f0',
  ink: '#0e1a2b',
  muted: '#5b6b82',
  code: '#eef2f8',
} as const;

export const DARK = {
  page: '#0a1220',
  card: '#101c2e',
  line: '#1e2d45',
  ink: '#e6edf7',
  muted: '#93a3ba',
  code: '#16243a',
} as const;

export const LAYOUT_TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';
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

const BASE_DARK_RULES = [
  `.pyxis-page{background-color:${DARK.page}!important;}`,
  `.pyxis-card{background-color:${DARK.card}!important;border-color:${DARK.line}!important;}`,
  `.pyxis-ink{color:${DARK.ink}!important;}`,
  `.pyxis-muted{color:${DARK.muted}!important;}`,
];

export interface TextBlock {
  readonly tone: keyof typeof TONES;
  readonly size: keyof typeof TEXT_SIZES;
  readonly margin: string;
}

export function paragraph({ tone, size, margin }: TextBlock, content: string): string {
  const { className, color } = TONES[tone];
  const style = `margin:${margin};font-family:${SANS_FONTS};${TEXT_SIZES[size]}color:${color};`;
  return `<p class="${className}" style="${style}">${content}</p>`;
}

export function inkLink(href: string, label: string): string {
  return (
    `<a class="pyxis-ink" href="${escapeHtml(href)}" ` +
    `style="color:${LIGHT.ink};text-decoration:underline;">${escapeHtml(label)}</a>`
  );
}

export function heading(content: string): string {
  const style =
    `margin:0 0 8px 0;font-family:${SANS_FONTS};font-size:20px;line-height:28px;` +
    `font-weight:600;color:${LIGHT.ink};`;
  return `<h1 class="pyxis-ink" style="${style}">${escapeHtml(content)}</h1>`;
}

export function brandHeader(logoAlt: string): readonly string[] {
  const logo =
    `<img src="${escapeHtml(EMAIL_LOGO_URL)}" srcset="${escapeHtml(EMAIL_LOGO_2X_URL)} 2x" ` +
    `width="${String(LOGO_SIZE_PX)}" height="${String(LOGO_SIZE_PX)}" ` +
    `alt="${escapeHtml(logoAlt)}" style="display:block;border:0;outline:none;">`;
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

export function cardRow(content: readonly string[]): readonly string[] {
  const style = `background-color:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:12px;padding:32px;`;
  return ['<tr>', `<td class="pyxis-card" style="${style}">`, ...content, '</td>', '</tr>'];
}

export interface EmailDocument {
  readonly language: string;
  readonly title: string;
  readonly preheader: string;
  readonly rows: readonly string[];
  readonly darkRules?: readonly string[];
}

export function emailDocument({
  language,
  title,
  preheader,
  rows,
  darkRules = [],
}: EmailDocument): string {
  const contentTableStyle = `width:100%;max-width:${String(CONTENT_WIDTH_PX)}px;`;
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}" dir="ltr">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="supported-color-schemes" content="light dark">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    ':root{color-scheme:light dark;supported-color-schemes:light dark;}',
    '@media (prefers-color-scheme:dark){',
    ...BASE_DARK_RULES,
    ...darkRules,
    '}',
    '</style>',
    '</head>',
    `<body class="pyxis-page" style="margin:0;padding:0;background-color:${LIGHT.page};">`,
    `<div style="${PREHEADER_STYLE}">${escapeHtml(preheader)}`,
    `${PREHEADER_FILLER}</div>`,
    `<table ${LAYOUT_TABLE} width="100%" class="pyxis-page" ` +
      `style="background-color:${LIGHT.page};">`,
    '<tr>',
    '<td align="center" style="padding:32px 16px;">',
    `<table ${LAYOUT_TABLE} width="${String(CONTENT_WIDTH_PX)}" style="${contentTableStyle}">`,
    ...rows,
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

export function wrapped(paragraphText: string): readonly string[] {
  return wrapText(paragraphText, TEXT_LINE_WIDTH);
}
