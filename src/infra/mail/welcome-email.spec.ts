import type { Welcome } from '../../domain/accounts/welcome';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildWelcomeEmail } from './welcome-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const TERMS = { version: '2026-11-01', url: 'https://example.com/termos' };
const TRIAL: Welcome = {
  plan: { kind: 'trial', trialEndsAt: new Date('2026-11-15T12:00:00.000Z') },
  terms: TERMS,
};
const ACTIVE: Welcome = { plan: { kind: 'subscription' }, terms: null };
const FREE: Welcome = {
  plan: {
    kind: 'free',
    limits: { eventsPerMonth: 10_000, projects: 1, people: 1 },
    pauseAtEvents: 10_000,
  },
  terms: TERMS,
};

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildWelcomeEmail', () => {
  it('confirms the subscription, the end of the trial and the terms accepted, with a button', () => {
    const email = buildWelcomeEmail(TRIAL, 'en', LINKS, null);

    expect(email.subject).toBe('Welcome to Pyxis');
    expect(email.html).toContain('Your free trial runs until November 15, 2026.');
    expect(email.html).toContain('The free trial runs until November 15, 2026;');
    expect(email.html).toContain('create your first project in the dashboard');
    expect(email.html).toContain('version 2026-11-01, written in Brazilian Portuguese');
    expect(email.html).toContain('Open the dashboard</a>');
    expect(email.text).toContain('https://example.com/termos');
  });

  it('confirms an active subscription without a trial, and leaves out terms it does not have', () => {
    const email = buildWelcomeEmail(ACTIVE, 'pt-BR', LINKS, null);

    expect(email.subject).toBe('Boas-vindas ao Pyxis');
    expect(email.html).toContain('Sua assinatura está ativa.');
    expect(email.html).toContain('Sua assinatura está confirmada e ativa.');
    expect(email.html).not.toContain('Termos de Uso');
    expect(email.text).not.toContain('Termos de Uso');
  });

  it('writes the trial end in the reader’s language', () => {
    expect(buildWelcomeEmail(TRIAL, 'es', LINKS, null).html).toContain(
      'La prueba gratuita dura hasta el 15 de noviembre de 2026;',
    );
  });

  it('welcomes an account on the free plan with its limits, the pause and how to subscribe', () => {
    const email = buildWelcomeEmail(FREE, 'en', LINKS, null);

    expect(email.subject).toBe('Welcome to Pyxis');
    expect(email.html).toContain('Your account is on the free plan.');
    expect(email.html).toContain('up to 10,000 events a month, 1 project and 1 person');
    expect(email.html).toContain('Measuring pauses when the month reaches 10,000 events');
    expect(email.html).toContain('create your first project in the dashboard');
    expect(email.html).toContain(
      'A free account that stores no events in its first 30 days, or none for 90 days in a row',
    );
    expect(email.html).toContain('because you created a Pyxis account.');
    expect(email.text).not.toContain('because you subscribed');
    expect(email.html).toContain('version 2026-11-01, written in Brazilian Portuguese');
  });

  it('counts the free plan in the plural and in the reader’s number format', () => {
    const wider: Welcome = {
      ...FREE,
      plan: {
        kind: 'free',
        limits: { eventsPerMonth: 25_000, projects: 2, people: 3 },
        pauseAtEvents: 25_000,
      },
    };

    expect(buildWelcomeEmail(wider, 'en', LINKS, null).html).toContain('2 projects and 3 people');
    expect(buildWelcomeEmail(FREE, 'pt-BR', LINKS, null).html).toContain(
      'até 10.000 eventos por mês, 1 projeto e 1 pessoa',
    );
    expect(buildWelcomeEmail(wider, 'de', LINKS, null).html).toContain('2 Projekte und 3 Personen');
  });

  it('declares its language and keeps every plain-text line short', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const welcome of [TRIAL, ACTIVE, FREE]) {
        const email = buildWelcomeEmail(welcome, language, LINKS, null);
        expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
        expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      }
    }
  });
});
