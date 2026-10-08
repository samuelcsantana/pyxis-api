import { escapeHtml } from './escape-html';

export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export function buildSignInCodeEmail(code: string): EmailContent {
  const text = [
    `Your Pyxis sign-in code is ${code}.`,
    '',
    'It expires in 10 minutes and works once. If you did not ask to sign in, ignore this email.',
  ].join('\n');
  const html = [
    '<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0e1a2b">',
    '<p>Your Pyxis sign-in code is</p>',
    `<p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${escapeHtml(code)}</p>`,
    '<p>It expires in 10 minutes and works once. If you did not ask to sign in, ignore this email.</p>',
    '</body></html>',
  ].join('');
  return { subject: `${code} is your Pyxis sign-in code`, html, text };
}
