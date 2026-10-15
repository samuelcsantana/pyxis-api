import type { Welcome } from '../../domain/accounts/welcome';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildWelcomeEmail } from './welcome-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const TERMS = { version: '2026-11-01', url: 'https://example.com/termos' };
const TRIAL: Welcome = { trialEndsAt: new Date('2026-11-15T12:00:00.000Z'), terms: TERMS };
const ACTIVE: Welcome = { trialEndsAt: null, terms: null };

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildWelcomeEmail', () => {
  it('confirms the subscription, the end of the trial and the terms accepted, with a button', () => {
    const email = buildWelcomeEmail(TRIAL, 'en', LINKS);

    expect(email.subject).toBe('Welcome to Pyxis');
    expect(email.html).toContain('Your free trial runs until November 15, 2026.');
    expect(email.html).toContain('The free trial runs until November 15, 2026;');
    expect(email.html).toContain('create your first project in the dashboard');
    expect(email.html).toContain('version 2026-11-01, written in Brazilian Portuguese');
    expect(email.html).toContain('Open the dashboard</a>');
    expect(email.text).toContain('https://example.com/termos');
  });

  it('confirms an active subscription without a trial, and leaves out terms it does not have', () => {
    const email = buildWelcomeEmail(ACTIVE, 'pt-BR', LINKS);

    expect(email.subject).toBe('Boas-vindas ao Pyxis');
    expect(email.html).toContain('Sua assinatura está ativa.');
    expect(email.html).toContain('Sua assinatura está confirmada e ativa.');
    expect(email.html).not.toContain('Termos de Uso');
    expect(email.text).not.toContain('Termos de Uso');
  });

  it('writes the trial end in the reader’s language', () => {
    expect(buildWelcomeEmail(TRIAL, 'es', LINKS).html).toContain(
      'La prueba gratuita dura hasta el 15 de noviembre de 2026;',
    );
  });

  it('declares its language and keeps every plain-text line short', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const welcome of [TRIAL, ACTIVE]) {
        const email = buildWelcomeEmail(welcome, language, LINKS);
        expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
        expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      }
    }
  });
});
