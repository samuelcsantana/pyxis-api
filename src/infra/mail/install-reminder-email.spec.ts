import type { InstallReminder } from '../../domain/accounts/install-reminder';
import { EMAIL_LANGUAGES, type EmailLanguage } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildInstallReminderEmail, installPageUrl } from './install-reminder-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const SUPPORT = 'hello@example.com';
const PROJECT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const WITH_PROJECT: InstallReminder = { project: { id: PROJECT_ID, name: 'Acme Store' } };
const WITHOUT_PROJECT: InstallReminder = { project: null };
const INSTALL_URL = `https://dashboard.example.com/${PROJECT_ID}/install`;

const INSTALL_TABS: Readonly<Record<EmailLanguage, readonly string[]>> = {
  en: ['Yourself', 'With an AI agent', 'Google Tag Manager'],
  'pt-BR': ['Você mesmo', 'Com um agente de IA', 'Google Tag Manager'],
  es: ['Por tu cuenta', 'Con un agente de IA', 'Google Tag Manager'],
  de: ['Selbst', 'Mit einem KI-Agenten', 'Google Tag Manager'],
  fr: ['Vous-même', 'Avec un agent IA', 'Google Tag Manager'],
  it: ['Per conto tuo', 'Con un agente IA', 'Google Tag Manager'],
  nl: ['Zelf', 'Met een AI-agent', 'Google Tag Manager'],
};

function longestProseLine(content: string): number {
  const prose = content.split('\n').filter((line) => !line.startsWith('https://'));
  return Math.max(...prose.map((line) => line.length));
}

function linksOf(html: string): readonly string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? '');
}

describe('buildInstallReminderEmail', () => {
  it('points the owner of a project with no visit at its Install screen', () => {
    const email = buildInstallReminderEmail(WITH_PROJECT, 'en', LINKS, null);

    expect(email.subject).toBe('Your Pyxis project is waiting for its first visit');
    expect(email.html).toContain('Install Pyxis on your site in one of three ways.');
    expect(email.html).toContain('Your project Acme Store is ready, but no visit has reached it');
    expect(email.html).toContain(`<a href="${INSTALL_URL}"`);
    expect(email.html).toContain('Open Install</a>');
    expect(email.html).toContain('This is the only reminder we will send.');
    expect(email.html).toContain('because you created a Pyxis account.');
    expect(email.text).toContain(`Open Install:\n${INSTALL_URL}`);
  });

  it('asks an account without a project to create one, with the dashboard as the link', () => {
    const email = buildInstallReminderEmail(WITHOUT_PROJECT, 'en', LINKS, null);

    expect(email.subject).toBe('Create your first Pyxis project');
    expect(email.html).toContain('it has no project yet');
    expect(email.html).toContain('<a href="https://dashboard.example.com/"');
    expect(email.html).toContain('Open the dashboard</a>');
    expect(email.html).not.toContain('/install');
    expect(email.text).toContain('Open the dashboard:\nhttps://dashboard.example.com/\n');
  });

  it('builds the Install address from the project id alone', () => {
    expect(installPageUrl({ id: PROJECT_ID, name: 'Acme Store' }, LINKS)).toBe(INSTALL_URL);
  });

  it('names the three ways exactly as the Install screen’s tabs, in every language', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const reminder of [WITH_PROJECT, WITHOUT_PROJECT]) {
        const email = buildInstallReminderEmail(reminder, language, LINKS, null);
        for (const tab of INSTALL_TABS[language]) {
          expect(email.html).toContain(`<strong style="font-weight:600;">${tab}</strong>`);
          expect(email.text).toContain(tab);
        }
      }
    }
  });

  it('writes the reminder in the reader’s language', () => {
    const email = buildInstallReminderEmail(WITH_PROJECT, 'pt-BR', LINKS, null);

    expect(email.subject).toBe('Seu projeto no Pyxis está esperando a primeira visita');
    expect(email.html).toContain('Seu projeto Acme Store está pronto');
    expect(email.html).toContain('Abrir a Instalação</a>');
    expect(buildInstallReminderEmail(WITHOUT_PROJECT, 'de', LINKS, null).subject).toBe(
      'Lege dein erstes Pyxis-Projekt an',
    );
  });

  it('escapes the project name in the HTML and collapses its blank space', () => {
    const email = buildInstallReminderEmail(
      { project: { id: PROJECT_ID, name: '  <b>Acme</b>\n  & Co ' } },
      'en',
      LINKS,
      null,
    );

    expect(email.html).toContain('Your project &lt;b&gt;Acme&lt;/b&gt; &amp; Co is ready');
    expect(email.html).not.toContain('<b>Acme');
    expect(email.text).toContain('Your project <b>Acme</b> & Co is ready');
    expect(email.subject).not.toContain('Acme');
  });

  it('names the support address when one is set, and only then', () => {
    const withSupport = buildInstallReminderEmail(WITH_PROJECT, 'en', LINKS, SUPPORT);
    const without = buildInstallReminderEmail(WITH_PROJECT, 'en', LINKS, null);

    expect(withSupport.html).toContain(`write to ${SUPPORT}.`);
    expect(withSupport.text).toContain(`write to ${SUPPORT}.`);
    expect(without.html).not.toContain(SUPPORT);
  });

  it('declares its language, keeps every plain-text line short and links without parameters', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const reminder of [WITH_PROJECT, WITHOUT_PROJECT]) {
        const email = buildInstallReminderEmail(reminder, language, LINKS, SUPPORT);
        expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
        expect(longestProseLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
        expect(linksOf(email.html).filter((link) => link.includes('?'))).toEqual([]);
        expect(
          email.text.split('\n').filter((line) => line.includes('https://') && line.includes('?')),
        ).toEqual([]);
      }
    }
  });
});
