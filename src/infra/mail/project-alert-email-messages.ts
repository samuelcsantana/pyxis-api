import type { EmailLanguage } from '../../domain/auth/email-language';
import { WEEKLY_DIGEST_EMAIL_MESSAGES } from './weekly-digest-email-messages';

export interface AlertCopy<Subject, Body> {
  readonly subject: Subject;
  readonly heading: string;
  readonly body: Body;
  readonly hint: string;
  readonly button: string;
  readonly turnOff: string;
}

export interface ProjectAlertEmailMessages {
  readonly language: EmailLanguage;
  readonly kicker: string;
  readonly noEvents: AlertCopy<
    (project: string) => string,
    (project: string, lastEvent: string, visitsBefore: string) => string
  >;
  readonly failedWrites: AlertCopy<
    (project: string, failed: string, day: string) => string,
    (day: string, failed: string, total: string, rate: string, usualRate: string) => string
  >;
  readonly conversionDrop: AlertCopy<
    (project: string, goal: string, day: string) => string,
    (
      goal: string,
      day: string,
      conversions: string,
      comparedDay: string,
      compared: string,
    ) => string
  >;
  readonly reason: (project: string) => string;
  readonly settings: string;
  readonly about: string;
  readonly logoAlt: string;
}

export const PROJECT_ALERT_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, ProjectAlertEmailMessages>
> = {
  en: {
    language: 'en',
    kicker: 'Alert',
    noEvents: {
      subject: (project) => `${project}: no events in the last 24 hours`,
      heading: 'No events for 24 hours',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis has received no events from ${project} since ${lastEvent}, after ` +
        `${visitsBefore} visits in the week before.`,
      hint: 'A site that is down, a script removed in a deploy or a blocked domain are the usual causes.',
      button: 'Check the install',
      turnOff: 'To stop these alerts, turn off “No events” in',
    },
    failedWrites: {
      subject: (project, failed, day) => `${project}: ${failed} failed writes on ${day}`,
      heading: 'More writes failed than usual',
      body: (day, failed, total, rate, usualRate) =>
        `On ${day}, ${failed} of ${total} writes failed (${rate}), against ${usualRate} in the ` +
        'seven days before.',
      hint: 'The Requests screen shows which routes failed and with which statuses.',
      button: 'Open Requests',
      turnOff: 'To stop these alerts, turn off “Failed writes” in',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} fell on ${day}`,
      heading: 'Conversions fell',
      body: (goal, day, conversions, comparedDay, compared) =>
        `The goal ${goal} was reached ${conversions} times on ${day}, against ${compared} ` +
        `on ${comparedDay}, the same weekday a week earlier.`,
      hint: 'The Overview compares every number with the week before.',
      button: 'Open the Overview',
      turnOff: 'To stop these alerts, turn off “Conversion drop” in',
    },
    reason: (project) =>
      `You receive this alert as an admin of ${project} in Pyxis, at most once a day for each kind.`,
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.en.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.en.about,
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    kicker: 'Alerta',
    noEvents: {
      subject: (project) => `${project}: nenhum evento nas últimas 24 horas`,
      heading: 'Nenhum evento há 24 horas',
      body: (project, lastEvent, visitsBefore) =>
        `O Pyxis não recebe eventos de ${project} desde ${lastEvent}, depois de ` +
        `${visitsBefore} visitas na semana anterior.`,
      hint:
        'As causas mais comuns são o site fora do ar, o script removido num deploy ou o ' +
        'domínio bloqueado.',
      button: 'Conferir a instalação',
      turnOff: 'Para parar estes alertas, desligue “Nenhum evento” em',
    },
    failedWrites: {
      subject: (project, failed, day) => `${project}: ${failed} escritas com falha em ${day}`,
      heading: 'Mais escritas falharam que o normal',
      body: (day, failed, total, rate, usualRate) =>
        `Em ${day}, ${failed} de ${total} escritas falharam (${rate}), contra ${usualRate} ` +
        'nos sete dias anteriores.',
      hint: 'A tela Requisições mostra quais rotas falharam e com quais status.',
      button: 'Abrir Requisições',
      turnOff: 'Para parar estes alertas, desligue “Escritas com falha” em',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} caiu em ${day}`,
      heading: 'As conversões caíram',
      body: (goal, day, conversions, comparedDay, compared) =>
        `A meta ${goal} foi alcançada ${conversions} vezes em ${day}, contra ${compared} em ` +
        `${comparedDay}, o mesmo dia da semana uma semana antes.`,
      hint: 'A Visão geral compara cada número com a semana anterior.',
      button: 'Abrir a Visão geral',
      turnOff: 'Para parar estes alertas, desligue “Queda de conversões” em',
    },
    reason: (project) =>
      `Você recebe este alerta por ser admin de ${project} no Pyxis, no máximo uma vez por dia ` +
      'de cada tipo.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES['pt-BR'].settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES['pt-BR'].about,
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    kicker: 'Alerta',
    noEvents: {
      subject: (project) => `${project}: ningún evento en las últimas 24 horas`,
      heading: 'Ningún evento en 24 horas',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis no recibe eventos de ${project} desde ${lastEvent}, tras ${visitsBefore} ` +
        'visitas la semana anterior.',
      hint:
        'Las causas habituales son un sitio caído, un script eliminado en un despliegue o un ' +
        'dominio bloqueado.',
      button: 'Revisar la instalación',
      turnOff: 'Para dejar de recibir estas alertas, desactiva “Ningún evento” en',
    },
    failedWrites: {
      subject: (project, failed, day) => `${project}: ${failed} escrituras fallidas el ${day}`,
      heading: 'Fallaron más escrituras de lo habitual',
      body: (day, failed, total, rate, usualRate) =>
        `El ${day}, fallaron ${failed} de ${total} escrituras (${rate}), frente a ${usualRate} ` +
        'en los siete días anteriores.',
      hint: 'La pantalla Solicitudes muestra qué rutas fallaron y con qué estados.',
      button: 'Abrir Solicitudes',
      turnOff: 'Para dejar de recibir estas alertas, desactiva “Escrituras fallidas” en',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} cayó el ${day}`,
      heading: 'Las conversiones cayeron',
      body: (goal, day, conversions, comparedDay, compared) =>
        `El objetivo ${goal} se alcanzó ${conversions} veces el ${day}, frente a ${compared} ` +
        `el ${comparedDay}, el mismo día de la semana una semana antes.`,
      hint: 'La Vista general compara cada número con la semana anterior.',
      button: 'Abrir la Vista general',
      turnOff: 'Para dejar de recibir estas alertas, desactiva “Caída de conversiones” en',
    },
    reason: (project) =>
      `Recibes esta alerta porque eres admin de ${project} en Pyxis, como mucho una vez al día ` +
      'de cada tipo.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.es.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.es.about,
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    kicker: 'Hinweis',
    noEvents: {
      subject: (project) => `${project}: keine Ereignisse in den letzten 24 Stunden`,
      heading: 'Seit 24 Stunden keine Ereignisse',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis hat seit ${lastEvent} keine Ereignisse von ${project} erhalten, nach ` +
        `${visitsBefore} Besuchen in der Woche davor.`,
      hint:
        'Häufige Ursachen sind eine Website, die nicht erreichbar ist, ein bei einem Deployment ' +
        'entferntes Skript oder eine blockierte Domain.',
      button: 'Installation prüfen',
      turnOff: 'Um diese Hinweise abzustellen, deaktiviere „Keine Ereignisse“ in den',
    },
    failedWrites: {
      subject: (project, failed, day) =>
        `${project}: ${failed} fehlgeschlagene Schreibzugriffe am ${day}`,
      heading: 'Mehr Schreibzugriffe als üblich sind fehlgeschlagen',
      body: (day, failed, total, rate, usualRate) =>
        `Am ${day} sind ${failed} von ${total} Schreibzugriffen fehlgeschlagen (${rate}), ` +
        `gegenüber ${usualRate} in den sieben Tagen davor.`,
      hint: 'Die Ansicht Anfragen zeigt, welche Routen mit welchem Status fehlgeschlagen sind.',
      button: 'Anfragen öffnen',
      turnOff:
        'Um diese Hinweise abzustellen, deaktiviere „Fehlgeschlagene Schreibzugriffe“ in den',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} ist am ${day} gesunken`,
      heading: 'Die Conversions sind gesunken',
      body: (goal, day, conversions, comparedDay, compared) =>
        `Das Ziel ${goal} wurde am ${day} ${conversions}-mal erreicht, gegenüber ${compared} ` +
        `am ${comparedDay}, demselben Wochentag eine Woche zuvor.`,
      hint: 'Die Übersicht vergleicht jede Zahl mit der Vorwoche.',
      button: 'Übersicht öffnen',
      turnOff: 'Um diese Hinweise abzustellen, deaktiviere „Rückgang der Conversions“ in den',
    },
    reason: (project) =>
      `Du bekommst diesen Hinweis als Admin von ${project} bei Pyxis, höchstens einmal am Tag ` +
      'pro Art.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.de.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.de.about,
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    kicker: 'Alerte',
    noEvents: {
      subject: (project) => `${project} : aucun événement ces dernières 24 heures`,
      heading: 'Aucun événement depuis 24 heures',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis ne reçoit plus d’événements de ${project} depuis le ${lastEvent}, après ` +
        `${visitsBefore} visites la semaine précédente.`,
      hint:
        'Les causes habituelles sont un site hors ligne, un script retiré lors d’un déploiement ' +
        'ou un domaine bloqué.',
      button: 'Vérifier l’installation',
      turnOff: 'Pour ne plus recevoir ces alertes, désactivez « Aucun événement » dans les',
    },
    failedWrites: {
      subject: (project, failed, day) => `${project} : ${failed} écritures en échec le ${day}`,
      heading: 'Plus d’écritures en échec que d’habitude',
      body: (day, failed, total, rate, usualRate) =>
        `Le ${day}, ${failed} écritures sur ${total} ont échoué (${rate}), contre ${usualRate} ` +
        'les sept jours précédents.',
      hint: 'L’écran Requêtes montre quelles routes ont échoué et avec quels statuts.',
      button: 'Ouvrir Requêtes',
      turnOff: 'Pour ne plus recevoir ces alertes, désactivez « Écritures en échec » dans les',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project} : ${goal} a baissé le ${day}`,
      heading: 'Les conversions ont baissé',
      body: (goal, day, conversions, comparedDay, compared) =>
        `L’objectif ${goal} a été atteint ${conversions} fois le ${day}, contre ${compared} ` +
        `le ${comparedDay}, le même jour de la semaine précédente.`,
      hint: 'La Vue d’ensemble compare chaque chiffre à la semaine précédente.',
      button: 'Ouvrir la Vue d’ensemble',
      turnOff: 'Pour ne plus recevoir ces alertes, désactivez « Baisse des conversions » dans les',
    },
    reason: (project) =>
      `Vous recevez cette alerte en tant qu’admin de ${project} dans Pyxis, au plus une fois ` +
      'par jour pour chaque type.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.fr.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.fr.about,
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    kicker: 'Avviso',
    noEvents: {
      subject: (project) => `${project}: nessun evento nelle ultime 24 ore`,
      heading: 'Nessun evento da 24 ore',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis non riceve eventi da ${project} dal ${lastEvent}, dopo ${visitsBefore} visite ` +
        'nella settimana precedente.',
      hint:
        'Le cause più comuni sono un sito non raggiungibile, uno script rimosso in un deploy o ' +
        'un dominio bloccato.',
      button: 'Controlla l’installazione',
      turnOff: 'Per non ricevere più questi avvisi, disattiva “Nessun evento” in',
    },
    failedWrites: {
      subject: (project, failed, day) => `${project}: ${failed} scritture fallite il ${day}`,
      heading: 'Più scritture fallite del solito',
      body: (day, failed, total, rate, usualRate) =>
        `Il ${day} sono fallite ${failed} scritture su ${total} (${rate}), contro ` +
        `${usualRate} nei sette giorni precedenti.`,
      hint: 'La schermata Richieste mostra quali route sono fallite e con quali stati.',
      button: 'Apri Richieste',
      turnOff: 'Per non ricevere più questi avvisi, disattiva “Scritture fallite” in',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} è calato il ${day}`,
      heading: 'Le conversioni sono calate',
      body: (goal, day, conversions, comparedDay, compared) =>
        `L’obiettivo ${goal} è stato raggiunto ${conversions} volte il ${day}, contro ` +
        `${compared} il ${comparedDay}, lo stesso giorno della settimana precedente.`,
      hint: 'La Panoramica confronta ogni numero con la settimana precedente.',
      button: 'Apri la Panoramica',
      turnOff: 'Per non ricevere più questi avvisi, disattiva “Calo delle conversioni” in',
    },
    reason: (project) =>
      `Ricevi questo avviso perché sei admin di ${project} su Pyxis, al massimo una volta al ` +
      'giorno per tipo.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.it.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.it.about,
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    kicker: 'Melding',
    noEvents: {
      subject: (project) => `${project}: geen events in de afgelopen 24 uur`,
      heading: 'Al 24 uur geen events',
      body: (project, lastEvent, visitsBefore) =>
        `Pyxis heeft sinds ${lastEvent} geen events van ${project} ontvangen, na ` +
        `${visitsBefore} bezoeken in de week ervoor.`,
      hint:
        'Gebruikelijke oorzaken zijn een site die offline is, een script dat bij een deploy is ' +
        'verwijderd of een geblokkeerd domein.',
      button: 'Installatie controleren',
      turnOff: 'Wil je deze meldingen niet meer? Zet “Geen events” uit in',
    },
    failedWrites: {
      subject: (project, failed, day) =>
        `${project}: ${failed} mislukte schrijfverzoeken op ${day}`,
      heading: 'Meer schrijfverzoeken mislukt dan normaal',
      body: (day, failed, total, rate, usualRate) =>
        `Op ${day} zijn ${failed} van de ${total} schrijfverzoeken mislukt (${rate}), tegenover ` +
        `${usualRate} in de zeven dagen ervoor.`,
      hint: 'Het scherm Verzoeken toont welke routes mislukten en met welke status.',
      button: 'Verzoeken openen',
      turnOff: 'Wil je deze meldingen niet meer? Zet “Mislukte schrijfverzoeken” uit in',
    },
    conversionDrop: {
      subject: (project, goal, day) => `${project}: ${goal} gedaald op ${day}`,
      heading: 'De conversies zijn gedaald',
      body: (goal, day, conversions, comparedDay, compared) =>
        `Het doel ${goal} is op ${day} ${conversions} keer bereikt, tegenover ${compared} ` +
        `op ${comparedDay}, dezelfde weekdag een week eerder.`,
      hint: 'Het Overzicht vergelijkt elk getal met de week ervoor.',
      button: 'Overzicht openen',
      turnOff: 'Wil je deze meldingen niet meer? Zet “Daling van conversies” uit in',
    },
    reason: (project) =>
      `Je ontvangt deze melding als beheerder van ${project} in Pyxis, hoogstens één keer per ` +
      'dag per soort.',
    settings: WEEKLY_DIGEST_EMAIL_MESSAGES.nl.settings,
    about: WEEKLY_DIGEST_EMAIL_MESSAGES.nl.about,
    logoAlt: 'Pyxis',
  },
};
