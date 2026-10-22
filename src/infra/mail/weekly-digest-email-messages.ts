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
      count === 1 ? `${writes} escrita com falha` : `${writes} escritas com falha`,
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
    failedWrites: 'Escritas com falha',
    ofWrites: (writes, rate) => `de ${writes} escritas, ${rate}`,
    noWrites: 'nenhuma escrita',
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
    noFailedWrites: 'Nenhuma escrita falhou na semana passada.',
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
  es: {
    language: 'es',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} usuario identificado` : `${users} usuarios identificados`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} visita con conversión` : `${visits} visitas con conversión`,
    failedWriteCount: (writes, count) =>
      count === 1 ? `${writes} escritura fallida` : `${writes} escrituras fallidas`,
    kicker: 'Resumen semanal',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'No llegó ninguna visita la semana pasada.',
    lastEventAt: (when) => `El último evento se recibió el ${when}.`,
    noEventEver: 'Todavía no llegó ningún evento para este proyecto.',
    visitCount: (visits, count) => (count === 1 ? `${visits} visita` : `${visits} visitas`),
    visits: 'Visitas',
    identifiedUsers: 'Usuarios identificados',
    identifiedUsersNote: 'iniciaron sesión al menos una vez',
    convertingVisits: 'Visitas con conversión',
    shareOfVisits: (share) => `${share} de las visitas`,
    failedWrites: 'Escrituras fallidas',
    ofWrites: (writes, rate) => `de ${writes} escrituras, ${rate}`,
    noWrites: 'ninguna escritura',
    versusWeekBefore: (change, previous) => `${change} frente a la semana anterior (${previous})`,
    unchangedFromWeekBefore: (previous) =>
      `sin variación frente a la semana anterior (${previous})`,
    weekBeforeOnly: (previous) => `${previous} la semana anterior`,
    visitsPerDay: 'Visitas por día',
    topPages: 'Páginas más vistas',
    noPageViews: 'No hubo vistas de página la semana pasada.',
    views: 'vistas',
    topEvents: 'Eventos principales',
    noNamedEvents: 'No hubo eventos con nombre la semana pasada.',
    times: 'veces',
    failingRoutes: 'Rutas con fallos',
    failedOf: (failed, total) => `${failed} de ${total} fallaron`,
    noFailedWrites: 'Ninguna escritura falló la semana pasada.',
    openWeek: 'Abrir la semana en el panel',
    reason: (project) => `Recibes este correo los lunes porque eres admin de ${project} en Pyxis.`,
    turnOff: 'Para dejar de recibirlo, desactiva el resumen semanal en',
    settings: 'Configuración',
    about:
      'Pyxis es analítica de producto que prioriza la privacidad: ' +
      'sin cookies y sin datos personales en los eventos.',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} identifizierter Nutzer` : `${users} identifizierte Nutzer`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} Besuch mit Conversion` : `${visits} Besuche mit Conversion`,
    failedWriteCount: (writes, count) =>
      count === 1
        ? `${writes} fehlgeschlagener Schreibzugriff`
        : `${writes} fehlgeschlagene Schreibzugriffe`,
    kicker: 'Wochenbericht',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'Letzte Woche kamen keine Besuche.',
    lastEventAt: (when) => `Das letzte Ereignis ging am ${when} ein.`,
    noEventEver: 'Für dieses Projekt sind noch keine Ereignisse eingegangen.',
    visitCount: (visits, count) => (count === 1 ? `${visits} Besuch` : `${visits} Besuche`),
    visits: 'Besuche',
    identifiedUsers: 'Identifizierte Nutzer',
    identifiedUsersNote: 'mindestens einmal angemeldet',
    convertingVisits: 'Besuche mit Conversion',
    shareOfVisits: (share) => `${share} der Besuche`,
    failedWrites: 'Fehlgeschlagene Schreibzugriffe',
    ofWrites: (writes, rate) => `von ${writes} Schreibzugriffen, ${rate}`,
    noWrites: 'keine Schreibzugriffe',
    versusWeekBefore: (change, previous) => `${change} ggü. der Vorwoche (${previous})`,
    unchangedFromWeekBefore: (previous) => `keine Veränderung ggü. der Vorwoche (${previous})`,
    weekBeforeOnly: (previous) => `${previous} in der Vorwoche`,
    visitsPerDay: 'Besuche pro Tag',
    topPages: 'Top-Seiten',
    noPageViews: 'Letzte Woche keine Seitenaufrufe.',
    views: 'Aufrufe',
    topEvents: 'Top-Ereignisse',
    noNamedEvents: 'Letzte Woche keine benannten Ereignisse.',
    times: 'Mal',
    failingRoutes: 'Fehlerhafte Routen',
    failedOf: (failed, total) => `${failed} von ${total} fehlgeschlagen`,
    noFailedWrites: 'Letzte Woche ist kein Schreibzugriff fehlgeschlagen.',
    openWeek: 'Woche im Dashboard öffnen',
    reason: (project) =>
      `Du bekommst diese E-Mail montags, weil du Admin von ${project} bei Pyxis bist.`,
    turnOff: 'Um sie nicht mehr zu bekommen, deaktiviere den Wochenbericht in den',
    settings: 'Einstellungen',
    about:
      'Pyxis ist datenschutzfreundliche Produktanalyse: ' +
      'keine Cookies, keine personenbezogenen Daten in den Ereignissen.',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count < 2 ? `${users} utilisateur identifié` : `${users} utilisateurs identifiés`,
    convertingVisitCount: (visits, count) =>
      count < 2 ? `${visits} visite avec conversion` : `${visits} visites avec conversion`,
    failedWriteCount: (writes, count) =>
      count < 2 ? `${writes} écriture en échec` : `${writes} écritures en échec`,
    kicker: 'Récapitulatif hebdomadaire',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'Aucune visite la semaine dernière.',
    lastEventAt: (when) => `Le dernier événement a été reçu le ${when}.`,
    noEventEver: 'Aucun événement n’est encore arrivé pour ce projet.',
    visitCount: (visits, count) => (count < 2 ? `${visits} visite` : `${visits} visites`),
    visits: 'Visites',
    identifiedUsers: 'Utilisateurs identifiés',
    identifiedUsersNote: 'connectés au moins une fois',
    convertingVisits: 'Visites avec conversion',
    shareOfVisits: (share) => `${share} des visites`,
    failedWrites: 'Écritures en échec',
    ofWrites: (writes, rate) => `sur ${writes} écritures, ${rate}`,
    noWrites: 'aucune écriture',
    versusWeekBefore: (change, previous) =>
      `${change} par rapport à la semaine précédente (${previous})`,
    unchangedFromWeekBefore: (previous) =>
      `aucune variation par rapport à la semaine précédente (${previous})`,
    weekBeforeOnly: (previous) => `${previous} la semaine précédente`,
    visitsPerDay: 'Visites par jour',
    topPages: 'Pages principales',
    noPageViews: 'Aucune page vue la semaine dernière.',
    views: 'vues',
    topEvents: 'Événements principaux',
    noNamedEvents: 'Aucun événement nommé la semaine dernière.',
    times: 'fois',
    failingRoutes: 'Routes en échec',
    failedOf: (failed, total) => `${failed} sur ${total} en échec`,
    noFailedWrites: 'Aucune écriture n’a échoué la semaine dernière.',
    openWeek: 'Ouvrir la semaine dans le tableau de bord',
    reason: (project) =>
      `Vous recevez cet e-mail le lundi en tant qu’admin de ${project} dans Pyxis.`,
    turnOff: 'Pour ne plus le recevoir, désactivez le récapitulatif hebdomadaire dans les',
    settings: 'Paramètres',
    about:
      'Pyxis est un outil d’analytique produit respectueux de la vie privée : ' +
      'aucun cookie, aucune donnée personnelle dans les événements.',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} utente identificato` : `${users} utenti identificati`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} visita con conversione` : `${visits} visite con conversione`,
    failedWriteCount: (writes, count) =>
      count === 1 ? `${writes} scrittura fallita` : `${writes} scritture fallite`,
    kicker: 'Riepilogo settimanale',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'Nessuna visita è arrivata la settimana scorsa.',
    lastEventAt: (when) => `L’ultimo evento è stato ricevuto il giorno ${when}.`,
    noEventEver: 'Per questo progetto non è ancora arrivato nessun evento.',
    visitCount: (visits, count) => (count === 1 ? `${visits} visita` : `${visits} visite`),
    visits: 'Visite',
    identifiedUsers: 'Utenti identificati',
    identifiedUsersNote: 'hanno effettuato l’accesso almeno una volta',
    convertingVisits: 'Visite con conversione',
    shareOfVisits: (share) => `${share} delle visite`,
    failedWrites: 'Scritture fallite',
    ofWrites: (writes, rate) => `su ${writes} scritture, ${rate}`,
    noWrites: 'nessuna scrittura',
    versusWeekBefore: (change, previous) =>
      `${change} rispetto alla settimana precedente (${previous})`,
    unchangedFromWeekBefore: (previous) =>
      `nessuna variazione rispetto alla settimana precedente (${previous})`,
    weekBeforeOnly: (previous) => `${previous} la settimana precedente`,
    visitsPerDay: 'Visite al giorno',
    topPages: 'Pagine principali',
    noPageViews: 'Nessuna visualizzazione di pagina la settimana scorsa.',
    views: 'visualizzazioni',
    topEvents: 'Eventi principali',
    noNamedEvents: 'Nessun evento con nome la settimana scorsa.',
    times: 'volte',
    failingRoutes: 'Rotte con errori',
    failedOf: (failed, total) => `fallite: ${failed} su ${total}`,
    noFailedWrites: 'Nessuna scrittura è fallita la settimana scorsa.',
    openWeek: 'Apri la settimana nella dashboard',
    reason: (project) => `Ricevi questa email il lunedì perché sei admin di ${project} su Pyxis.`,
    turnOff: 'Per non riceverla più, disattiva il riepilogo settimanale in',
    settings: 'Impostazioni',
    about:
      'Pyxis è uno strumento di analisi di prodotto attento alla privacy: ' +
      'nessun cookie e nessun dato personale negli eventi.',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    subject: (project, week, visits) => `${project} · ${week} · ${visits}`,
    identifiedUserCount: (users, count) =>
      count === 1 ? `${users} geïdentificeerde gebruiker` : `${users} geïdentificeerde gebruikers`,
    convertingVisitCount: (visits, count) =>
      count === 1 ? `${visits} bezoek met conversie` : `${visits} bezoeken met conversie`,
    failedWriteCount: (writes, count) =>
      count === 1 ? `${writes} mislukt schrijfverzoek` : `${writes} mislukte schrijfverzoeken`,
    kicker: 'Wekelijkse samenvatting',
    weekLine: (week, zoneName) => `${week} · ${zoneName}`,
    noVisits: 'Er kwamen vorige week geen bezoeken binnen.',
    lastEventAt: (when) => `Het laatste event is ontvangen op ${when}.`,
    noEventEver: 'Voor dit project zijn nog geen events binnengekomen.',
    visitCount: (visits, count) => (count === 1 ? `${visits} bezoek` : `${visits} bezoeken`),
    visits: 'Bezoeken',
    identifiedUsers: 'Geïdentificeerde gebruikers',
    identifiedUsersNote: 'minstens één keer ingelogd',
    convertingVisits: 'Bezoeken met conversie',
    shareOfVisits: (share) => `${share} van de bezoeken`,
    failedWrites: 'Mislukte schrijfverzoeken',
    ofWrites: (writes, rate) => `van ${writes} schrijfverzoeken, ${rate}`,
    noWrites: 'geen schrijfverzoeken',
    versusWeekBefore: (change, previous) => `${change} vs. de week ervoor (${previous})`,
    unchangedFromWeekBefore: (previous) => `geen verandering vs. de week ervoor (${previous})`,
    weekBeforeOnly: (previous) => `${previous} de week ervoor`,
    visitsPerDay: 'Bezoeken per dag',
    topPages: 'Toppagina’s',
    noPageViews: 'Vorige week geen paginaweergaven.',
    views: 'weergaven',
    topEvents: 'Topevents',
    noNamedEvents: 'Vorige week geen benoemde events.',
    times: 'keer',
    failingRoutes: 'Routes met fouten',
    failedOf: (failed, total) => `${failed} van ${total} mislukt`,
    noFailedWrites: 'Vorige week is er geen schrijfverzoek mislukt.',
    openWeek: 'De week openen in het dashboard',
    reason: (project) =>
      `Je ontvangt deze e-mail elke maandag als beheerder van ${project} in Pyxis.`,
    turnOff: 'Wil je hem niet meer ontvangen? Zet de wekelijkse samenvatting uit in',
    settings: 'Instellingen',
    about:
      'Pyxis is productanalyse die privacy vooropstelt: ' +
      'geen cookies en geen persoonsgegevens in events.',
    logoAlt: 'Pyxis',
  },
};
