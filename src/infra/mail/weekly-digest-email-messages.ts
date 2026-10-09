import type { EmailLanguage } from '../../domain/auth/email-language';

export interface WeeklyDigestEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: (project: string, week: string, visits: string) => string;
  readonly identifiedUserCount: (users: string, count: number) => string;
  readonly convertingVisitCount: (visits: string, count: number) => string;
  readonly failedWriteCount: (writes: string, count: number) => string;
  readonly kicker: string;
  readonly weekLine: (week: string, zoneName: string) => string;
  readonly noVisits: string;
  readonly lastEventAt: (when: string) => string;
  readonly noEventEver: string;
  readonly visitCount: (visits: string, count: number) => string;
  readonly visits: string;
  readonly identifiedUsers: string;
  readonly identifiedUsersNote: string;
  readonly convertingVisits: string;
  readonly shareOfVisits: (share: string) => string;
  readonly failedWrites: string;
  readonly ofWrites: (writes: string, rate: string) => string;
  readonly noWrites: string;
  readonly versusWeekBefore: (change: string, previous: string) => string;
  readonly unchangedFromWeekBefore: (previous: string) => string;
  readonly weekBeforeOnly: (previous: string) => string;
  readonly visitsPerDay: string;
  readonly topPages: string;
  readonly noPageViews: string;
  readonly views: string;
  readonly topEvents: string;
  readonly noNamedEvents: string;
  readonly times: string;
  readonly failingRoutes: string;
  readonly failedOf: (failed: string, total: string) => string;
  readonly noFailedWrites: string;
  readonly openWeek: string;
  readonly reason: (project: string) => string;
  readonly turnOff: string;
  readonly settings: string;
  readonly about: string;
  readonly logoAlt: string;
}

export const WEEKLY_DIGEST_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, WeeklyDigestEmailMessages>
> = {
  en: {
    language: 'en',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} identified user` : `${users} identified users`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} converting visit` : `${visits} converting visits`,
    failedWriteCount: (writes, count) =>
      count === 1 ? `${writes} failed write` : `${writes} failed writes`,
    kicker: 'Weekly digest',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'No visits arrived last week.',
    lastEventAt: (when) => `The last event was received on ${when}.`,
    noEventEver: 'No events have arrived for this project yet.',
    visitCount: (visits, count) => (count === 1 ? `${visits} visit` : `${visits} visits`),
    visits: 'Visits',
    identifiedUsers: 'Identified users',
    identifiedUsersNote: 'signed in at least once',
    convertingVisits: 'Converting visits',
    shareOfVisits: (share) => `${share} of visits`,
    failedWrites: 'Failed writes',
    ofWrites: (writes, rate) => `of ${writes} writes, ${rate}`,
    noWrites: 'no writes',
    versusWeekBefore: (change, previous) => `${change} vs. the week before (${previous})`,
    unchangedFromWeekBefore: (previous) => `no change vs. the week before (${previous})`,
    weekBeforeOnly: (previous) => `${previous} the week before`,
    visitsPerDay: 'Visits per day',
    topPages: 'Top pages',
    noPageViews: 'No page views last week.',
    views: 'views',
    topEvents: 'Top events',
    noNamedEvents: 'No named events last week.',
    times: 'times',
    failingRoutes: 'Failing routes',
    failedOf: (failed, total) => `${failed} of ${total} failed`,
    noFailedWrites: 'No writes failed last week.',
    openWeek: 'Open the week in the dashboard',
    reason: (project) => `You receive this email on Mondays as an admin of ${project} in Pyxis.`,
    turnOff: 'To stop receiving it, turn off the weekly digest in',
    settings: 'Settings',
    about: 'Pyxis is privacy-first product analytics: no cookies, no personal data in events.',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} usuário identificado` : `${users} usuários identificados`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} visita com conversão` : `${visits} visitas com conversão`,
    failedWriteCount: (writes, count) =>
      count === 1 ? `${writes} gravação com falha` : `${writes} gravações com falha`,
    kicker: 'Resumo semanal',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'Nenhuma visita chegou na semana passada.',
    lastEventAt: (when) => `O último evento foi recebido em ${when}.`,
    noEventEver: 'Nenhum evento chegou ainda para este projeto.',
    visitCount: (visits, count) => (count === 1 ? `${visits} visita` : `${visits} visitas`),
    visits: 'Visitas',
    identifiedUsers: 'Usuários identificados',
    identifiedUsersNote: 'entraram pelo menos uma vez',
    convertingVisits: 'Visitas com conversão',
    shareOfVisits: (share) => `${share} das visitas`,
    failedWrites: 'Gravações com falha',
    ofWrites: (writes, rate) => `de ${writes} gravações, ${rate}`,
    noWrites: 'nenhuma gravação',
    versusWeekBefore: (change, previous) => `${change} vs. a semana anterior (${previous})`,
    unchangedFromWeekBefore: (previous) => `sem variação vs. a semana anterior (${previous})`,
    weekBeforeOnly: (previous) => `${previous} na semana anterior`,
    visitsPerDay: 'Visitas por dia',
    topPages: 'Páginas mais vistas',
    noPageViews: 'Nenhuma visualização de página na semana passada.',
    views: 'visualizações',
    topEvents: 'Principais eventos',
    noNamedEvents: 'Nenhum evento nomeado na semana passada.',
    times: 'vezes',
    failingRoutes: 'Rotas com falha',
    failedOf: (failed, total) => `${failed} de ${total} falharam`,
    noFailedWrites: 'Nenhuma gravação falhou na semana passada.',
    openWeek: 'Abrir a semana no painel',
    reason: (project) =>
      `Você recebe este e-mail às segundas-feiras por ser admin de ${project} no Pyxis.`,
    turnOff: 'Para parar de receber, desligue o resumo semanal em',
    settings: 'Configurações',
    about:
      'O Pyxis é uma ferramenta de análise de produto que respeita a privacidade: ' +
      'sem cookies e sem dados pessoais nos eventos.',
    logoAlt: 'Pyxis',
  },
};
