import type { ProjectAlert } from '../../domain/alerts/project-alert';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildProjectAlertEmail } from './project-alert-email';
import { PROJECT_ALERT_EMAIL_MESSAGES } from './project-alert-email-messages';

const LINKS = emailLinksFor('https://dashboard.example.com');
const SUPPORT = 'hello@example.com';
const PROJECT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const ABOUT = {
  projectId: PROJECT_ID,
  projectName: 'Acme  <Store>',
  timeZone: 'America/Sao_Paulo',
};
const SILENCE: ProjectAlert = {
  ...ABOUT,
  kind: 'no_events',
  lastEventAt: new Date('2026-11-04T05:30:00.000Z'),
  visitsBefore: 1240,
};
const SPIKE: ProjectAlert = {
  ...ABOUT,
  kind: 'failed_writes',
  day: '2026-11-04',
  failed: 12,
  total: 40,
  usualRate: 0.02,
};
const DROP: ProjectAlert = {
  ...ABOUT,
  kind: 'conversion_drop',
  goalName: 'Purchase',
  day: '2026-11-04',
  conversions: 4,
  comparedDay: '2026-10-28',
  comparedConversions: 12,
};
const ALERTS = [SILENCE, SPIKE, DROP] as const;
const SETTINGS_URL = `https://dashboard.example.com/${PROJECT_ID}/settings#settings/email`;

function flat(content: string): string {
  return content.replace(/\s+/g, ' ');
}

function longestProseLine(content: string): number {
  const prose = content.split('\n').filter((line) => !line.startsWith('https://'));
  return Math.max(...prose.map((line) => line.length));
}

function linksOf(html: string): readonly string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? '');
}

describe('buildProjectAlertEmail', () => {
  it('says when the last event arrived, in the project time zone, and points at Install', () => {
    const email = buildProjectAlertEmail(SILENCE, 'en', LINKS, null);

    expect(email.subject).toBe('Acme <Store>: no events in the last 24 hours');
    expect(email.html).toContain('No events for 24 hours');
    expect(flat(email.text)).toContain(
      'Pyxis has received no events from Acme <Store> since November 4, 2026 at 2:30 AM ' +
        '(America/Sao_Paulo), after 1,240 visits in the week before.',
    );
    expect(email.html).toContain('Acme &lt;Store&gt;');
    expect(email.html).not.toContain('<Store>');
    expect(linksOf(email.html)).toContain(`https://dashboard.example.com/${PROJECT_ID}/install`);
    expect(email.text).toContain(
      `Check the install:\nhttps://dashboard.example.com/${PROJECT_ID}/install`,
    );
  });

  it('compares the failed writes of the day with the usual rate and points at Requests', () => {
    const email = buildProjectAlertEmail(SPIKE, 'en', LINKS, null);

    expect(email.subject).toBe('Acme <Store>: 12 failed writes on Wednesday, November 4');
    expect(flat(email.text)).toContain(
      'On Wednesday, November 4, 12 of 40 writes failed (30%), against 2% in the seven days',
    );
    expect(linksOf(email.html)).toContain(`https://dashboard.example.com/${PROJECT_ID}/requests`);
  });

  it('names the goal and the weekday it is compared with, and points at the Overview', () => {
    const email = buildProjectAlertEmail(DROP, 'en', LINKS, null);

    expect(email.subject).toBe('Acme <Store>: Purchase fell on Wednesday, November 4');
    expect(flat(email.text)).toContain(
      'The goal Purchase was reached 4 times on Wednesday, November 4, against 12 on Wednesday,',
    );
    expect(linksOf(email.html)).toContain(`https://dashboard.example.com/${PROJECT_ID}/overview`);
  });

  it.each(ALERTS)('lets the reader turn the $kind alert off in the project Settings', (alert) => {
    const email = buildProjectAlertEmail(alert, 'en', LINKS, null);

    expect(linksOf(email.html)).toContain(SETTINGS_URL);
    expect(email.text).toContain(SETTINGS_URL);
    expect(flat(email.text)).toContain('at most once a day for each kind.');
  });

  it.each(EMAIL_LANGUAGES)(
    'opens Settings on the e-mail section, where the switches are, in %s',
    (language) => {
      const email = buildProjectAlertEmail(SPIKE, language, LINKS, null);

      expect(linksOf(email.html)).toContain(SETTINGS_URL);
      expect(email.text).toContain(SETTINGS_URL);
    },
  );

  it('writes the numbers and days in the reader’s language', () => {
    const email = buildProjectAlertEmail(SILENCE, 'pt-BR', LINKS, null);
    const spike = buildProjectAlertEmail(SPIKE, 'de', LINKS, null);

    expect(email.subject).toBe('Acme <Store>: nenhum evento nas últimas 24 horas');
    expect(flat(email.text)).toContain('depois de 1.240 visitas na semana anterior.');
    expect(flat(spike.text)).toContain('Am Mittwoch, 4. November sind 12 von 40 Schreibzugriffen');
    expect(flat(spike.text)).toContain('(30 %)');
  });

  it('adds the support line when there is a support address', () => {
    const email = buildProjectAlertEmail(SPIKE, 'en', LINKS, SUPPORT);

    expect(email.html).toContain(SUPPORT);
    expect(email.text).toContain(SUPPORT);
  });

  it.each(EMAIL_LANGUAGES.flatMap((language) => ALERTS.map((alert) => [language, alert] as const)))(
    'keeps the %s text of a %o alert within the line width, in its language',
    (language, alert) => {
      const email = buildProjectAlertEmail(alert, language, LINKS, SUPPORT);

      expect(longestProseLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      expect(email.html).toContain(`lang="${language}"`);
      expect(email.html).toContain(PROJECT_ALERT_EMAIL_MESSAGES[language].kicker);
    },
  );
});
