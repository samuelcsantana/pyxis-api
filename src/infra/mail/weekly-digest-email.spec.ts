import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import { DASHBOARD_URL, EMAIL_LOGO_URL, TEXT_LINE_WIDTH } from './email-layout';
import { buildWeeklyDigestEmail } from './weekly-digest-email';

const PROJECT_ID = 'd2e07854-0000-4000-8000-000000000001';
const OVERVIEW_URL = `${DASHBOARD_URL}${PROJECT_ID}/overview?from=2026-10-05&to=2026-10-11`;
const SETTINGS_URL = `${DASHBOARD_URL}${PROJECT_ID}/settings`;
const OVERVIEW_HREF = `${DASHBOARD_URL}${PROJECT_ID}/overview?from=2026-10-05&amp;to=2026-10-11`;
const HTML_LINE_LIMIT = 400;
const GMAIL_CLIPPING_BYTES = 102 * 1024;
const HOSTILE = `<i>&"'`;
const RANGE_DASH = ' – ';
const ESCAPED_HOSTILE = '&lt;i&gt;&amp;&quot;&#39;';

const BUSY_WEEK: WeeklyDigest = {
  projectId: PROJECT_ID,
  projectName: 'Acme Store',
  timeZone: 'America/Sao_Paulo',
  week: { from: '2026-10-05', to: '2026-10-11' },
  visits: { current: 812, previous: 725 },
  identifiedUsers: { current: 120, previous: 120 },
  convertingVisits: { current: 41, previous: 0 },
  failedWrites: { current: { failed: 3, total: 1204 }, previous: { failed: 5, total: 1100 } },
  days: [
    { date: '2026-10-05', visits: 130 },
    { date: '2026-10-06', visits: 142 },
    { date: '2026-10-07', visits: 0 },
    { date: '2026-10-08', visits: 1 },
    { date: '2026-10-09', visits: 97 },
    { date: '2026-10-10', visits: 88 },
    { date: '2026-10-11', visits: 116 },
  ],
  topPages: [{ path: '/orders/:id', views: 1500, visits: 600 }],
  topEvents: [{ name: 'signup_completed', count: 50, visits: 41 }],
  failingRoutes: [{ method: 'POST', route: '/orders', failed: 2, total: 340 }],
  lastEventAt: new Date('2026-10-11T22:10:00.000Z'),
};

const QUIET_WEEK: WeeklyDigest = {
  ...BUSY_WEEK,
  visits: { current: 0, previous: 64 },
  identifiedUsers: { current: 0, previous: 0 },
  convertingVisits: null,
  failedWrites: { current: { failed: 0, total: 0 }, previous: { failed: 0, total: 4 } },
  days: BUSY_WEEK.days.map((day) => ({ ...day, visits: 0 })),
  topPages: [],
  topEvents: [],
  failingRoutes: [],
  lastEventAt: new Date('2026-10-02T14:31:00.000Z'),
};

function longestLine(content: string, ignoring = /^$/): number {
  return Math.max(
    ...content
      .split('\n')
      .filter((line) => !ignoring.test(line))
      .map((line) => line.length),
  );
}

function hrefs(html: string): readonly string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href ?? '');
}

function textOf(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

describe('the weekly digest in English', () => {
  const email = buildWeeklyDigestEmail(BUSY_WEEK, 'en');

  it('names the project, the week and the visits with their change in the subject', () => {
    expect(email.subject).toBe(`Acme Store · Oct 5${RANGE_DASH}11 · 812 visits (+12%)`);
  });

  it('says in the inbox preview what the e-mail compares', () => {
    expect(email.html).toMatch(
      /<div style="display:none;[^"]*">Visits, conversions and failed writes of Acme Store last week/,
    );
  });

  it('dates the week in full, in the time zone of the project', () => {
    expect(textOf(email.html)).toContain(
      'Monday, October 5 – Sunday, October 11, 2026 · America/Sao_Paulo time',
    );
  });

  it('compares each figure with the week before, saying so when nothing changed', () => {
    const text = textOf(email.html);

    expect(text).toContain('Visits 812 +12% vs. the week before (725)');
    expect(text).toContain(
      'Identified users 120 signed in at least once no change vs. the week before (120)',
    );
    expect(text).toContain('Converting visits 41 5.0% of visits 0 the week before');
    expect(text).toContain('Failed writes 3 of 1,204 writes, 0.2% -40% vs. the week before (5)');
  });

  it('draws a bar for each day, the busiest the tallest, and a hairline for a day without visits', () => {
    expect(email.html).toContain('height="64" style="height:64px;background-color:#f5b83d;');
    expect(email.html).toContain('height="3" style="height:3px;background-color:#f5b83d;');
    expect(email.html).toContain(
      'class="pyxis-empty-bar" height="1" style="height:1px;background-color:#e3e8f0;',
    );
    for (const weekday of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(email.html).toContain(`>${weekday}</td>`);
    }
  });

  it('lists the top pages and events and the writes that failed', () => {
    const text = textOf(email.html);

    expect(text).toContain('/orders/:id 1,500 views');
    expect(text).toContain('signup_completed 50 times');
    expect(text).toContain('POST /orders 2 of 340 failed');
  });

  it('links to the week in the dashboard and to the Settings where it can be turned off', () => {
    expect(hrefs(email.html)).toEqual([OVERVIEW_HREF, SETTINGS_URL]);
    expect(textOf(email.html)).toContain('To stop it, turn off the weekly digest in Settings .');
  });

  it('writes a plain-text twin with the same figures and both links', () => {
    expect(email.text).toBe(
      [
        'Weekly digest: Acme Store',
        `Monday, October 5${RANGE_DASH}Sunday, October 11, 2026 · America/Sao_Paulo time`,
        '',
        'Visits: 812 · +12% vs. the week before (725)',
        'Identified users: 120 (signed in at least once) · no change vs. the week',
        'before (120)',
        'Converting visits: 41 (5.0% of visits) · 0 the week before',
        'Failed writes: 3 (of 1,204 writes, 0.2%) · -40% vs. the week before (5)',
        '',
        'Visits per day',
        '  Mon  130',
        '  Tue  142',
        '  Wed  0',
        '  Thu  1',
        '  Fri  97',
        '  Sat  88',
        '  Sun  116',
        '',
        'Top pages',
        '  /orders/:id  1,500 views',
        '',
        'Top events',
        '  signup_completed  50 times',
        '',
        'Writes that failed',
        '  POST /orders  2 of 340 failed',
        '',
        `Open the week in the dashboard: ${OVERVIEW_URL}`,
        '',
        'You receive this e-mail on Mondays as an admin of Acme Store in Pyxis.',
        `To stop it, turn off the weekly digest in Settings: ${SETTINGS_URL}`,
        'Pyxis is privacy-first product analytics: no cookies, no personal data',
        'in events.',
      ].join('\n'),
    );
  });

  it('writes the dates with plain spaces, which every mail client shows', () => {
    for (const part of [email.subject, email.html, email.text]) {
      expect(part).not.toMatch(/[\u2009\u202f]/);
    }
  });

  it('declares English as its language', () => {
    expect(email.html).toContain('<html lang="en" dir="ltr">');
  });
});

describe('the weekly digest in Brazilian Portuguese', () => {
  const email = buildWeeklyDigestEmail(BUSY_WEEK, 'pt-BR');

  it('names the project, the week and the visits with their change in the subject', () => {
    expect(email.subject).toBe(`Acme Store · 5${RANGE_DASH}11 de out. · 812 visitas (+12%)`);
  });

  it('uses the words of the dashboard and Brazilian number formats', () => {
    const text = textOf(email.html);

    expect(text).toContain('Resumo semanal');
    expect(text).toContain('Visitas 812 +12% vs. a semana anterior (725)');
    expect(text).toContain(
      'Usuários identificados 120 entraram pelo menos uma vez sem variação vs. a semana anterior (120)',
    );
    expect(text).toContain('Visitas com conversão 41 5,0% das visitas 0 na semana anterior');
    expect(text).toContain('Gravações com falha 3 de 1.204 gravações, 0,2%');
    expect(text).toContain('Páginas mais vistas /orders/:id 1.500 visualizações');
    expect(text).toContain('Principais eventos signup_completed 50 vezes');
    expect(text).toContain('Gravações que falharam POST /orders 2 de 340 falharam');
    expect(text).toContain('Abrir a semana no painel');
    expect(text).toContain('Para parar de receber, desligue o resumo semanal em Configurações');
  });

  it('dates the week in Portuguese', () => {
    expect(email.text).toContain(
      `segunda-feira, 5 de outubro${RANGE_DASH}domingo, 11 de outubro de 2026`,
    );
    expect(email.text).toContain('  seg.  130');
  });

  it('declares Brazilian Portuguese as its language', () => {
    expect(email.html).toContain('<html lang="pt-BR" dir="ltr">');
  });
});

describe('a week without visits', () => {
  const email = buildWeeklyDigestEmail(QUIET_WEEK, 'en');

  it('says so first, with when the last event arrived in the project time zone', () => {
    expect(email.subject).toBe(`Acme Store · Oct 5${RANGE_DASH}11 · 0 visits (-100%)`);
    expect(email.html).toContain('class="pyxis-notice"');
    expect(email.text).toContain(
      'No visits arrived this week.\nThe last event was received on October 2, 2026 at 11:31 AM.',
    );
  });

  it('says when the last event arrived in Portuguese too', () => {
    expect(buildWeeklyDigestEmail(QUIET_WEEK, 'pt-BR').text).toContain(
      'Nenhuma visita chegou nesta semana.\nO último evento foi recebido em 2 de outubro de 2026 às 11:31.',
    );
  });

  it('gives converting visits without a share when there was no visit', () => {
    const converting = { ...QUIET_WEEK, convertingVisits: { current: 0, previous: 3 } };

    expect(buildWeeklyDigestEmail(converting, 'en').text).toContain(
      'Converting visits: 0 · -100% vs. the week before (3)',
    );
  });

  it('says when no event ever arrived', () => {
    const never = buildWeeklyDigestEmail({ ...QUIET_WEEK, lastEventAt: null }, 'pt-BR');

    expect(never.text).toContain(
      'Nenhuma visita chegou nesta semana.\nNenhum evento chegou ainda para este projeto.',
    );
  });

  it('leaves the conversion tile out of a project without a conversion event', () => {
    expect(email.text).not.toContain('Converting visits');
    expect(email.html).toContain('<td width="50%"></td>');
  });

  it('says there were no writes, and that nothing is listed', () => {
    expect(email.text).toContain('Failed writes: 0 (no writes) · 0 the week before');
    expect(email.text).toContain('Top pages\n  No page views this week.');
    expect(email.text).toContain('Top events\n  No named events this week.');
    expect(email.text).toContain('Writes that failed\n  No write failed this week.');
    expect(email.html).not.toContain('class="pyxis-ink pyxis-rule"');
  });

  it('draws only hairlines', () => {
    expect(email.html).not.toContain('background-color:#f5b83d;border-radius:3px');
  });
});

describe('a week with one visit and none the week before', () => {
  it('counts the visit in the singular and gives no change', () => {
    const single = { ...QUIET_WEEK, visits: { current: 1, previous: 0 } };

    expect(buildWeeklyDigestEmail(single, 'en').subject).toBe(
      `Acme Store · Oct 5${RANGE_DASH}11 · 1 visit`,
    );
    expect(buildWeeklyDigestEmail(single, 'pt-BR').subject).toBe(
      `Acme Store · 5${RANGE_DASH}11 de out. · 1 visita`,
    );
  });

  it('calls a change that rounds to zero no change', () => {
    const steady = { ...BUSY_WEEK, visits: { current: 1001, previous: 1000 } };

    expect(buildWeeklyDigestEmail(steady, 'en').subject).toBe(
      `Acme Store · Oct 5${RANGE_DASH}11 · 1,001 visits`,
    );
  });
});

describe.each(EMAIL_LANGUAGES)('the %s weekly digest', (language) => {
  const email = buildWeeklyDigestEmail(BUSY_WEEK, language);

  it('loads no image but the logo', () => {
    expect(email.html.split('<img').length - 1).toBe(1);
    expect(email.html).toContain(`<img src="${EMAIL_LOGO_URL}"`);
  });

  it('carries its styles inline and in its head, with a dark and a narrow-screen version', () => {
    expect(email.html).not.toMatch(/<link\b|@import|url\(/i);
    expect(email.html).toContain('@media (prefers-color-scheme:dark){');
    expect(email.html).toContain('.pyxis-tile{background-color:#16243a!important;}');
    expect(email.html).toContain('@media (max-width:480px){');
  });

  it('keeps the layout tables out of the accessibility tree', () => {
    const tables = email.html.match(/<table\b[^>]*>/g) ?? [];

    expect(tables.filter((table) => !table.includes('role="presentation"'))).toEqual([]);
  });

  it('keeps every line short enough for mail servers, and the plain text readable', () => {
    expect(longestLine(email.html)).toBeLessThanOrEqual(HTML_LINE_LIMIT);
    expect(longestLine(email.text, /https:\/\//)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
  });

  it('stays far below the size at which Gmail clips a message', () => {
    expect(Buffer.byteLength(email.html)).toBeLessThan(GMAIL_CLIPPING_BYTES);
  });
});

describe('customer data in the weekly digest', () => {
  const hostile: WeeklyDigest = {
    ...BUSY_WEEK,
    projectName: HOSTILE,
    topPages: [{ path: HOSTILE, views: 1, visits: 1 }],
    topEvents: [{ name: HOSTILE, count: 1, visits: 1 }],
    failingRoutes: [{ method: 'POST', route: HOSTILE, failed: 1, total: 1 }],
  };

  it('is escaped wherever it reaches the HTML', () => {
    const { html } = buildWeeklyDigestEmail(hostile, 'en');

    expect(html).not.toContain('<i>');
    expect(html).toContain(`<h1 class="pyxis-ink"`);
    expect(html.split(ESCAPED_HOSTILE).length - 1).toBe(7);
  });

  it('puts the project id in the links as a path segment only', () => {
    const { html } = buildWeeklyDigestEmail({ ...BUSY_WEEK, projectId: '../x?y' }, 'en');

    expect(hrefs(html)).toEqual([
      `${DASHBOARD_URL}..%2Fx%3Fy/overview?from=2026-10-05&amp;to=2026-10-11`,
      `${DASHBOARD_URL}..%2Fx%3Fy/settings`,
    ]);
  });
});
