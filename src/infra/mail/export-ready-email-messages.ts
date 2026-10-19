import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface ExportReadyWords {
  readonly project: string;
  readonly events: string;
  readonly until: string;
}

export interface ExportReadyEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: (words: ExportReadyWords) => string;
  readonly preheader: (words: ExportReadyWords) => string;
  readonly heading: string;
  readonly contents: (words: ExportReadyWords) => string;
  readonly availability: (words: ExportReadyWords) => string;
  readonly download: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const EXPORT_READY_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, ExportReadyEmailMessages>
> = {
  en: {
    language: 'en',
    subject: (w) => `Your export of ${w.project} is ready`,
    preheader: (w) => `${w.events} events, downloadable until ${w.until}.`,
    heading: 'Export ready',
    contents: (w) =>
      `The events of ${w.project} are in a compressed CSV file: ${w.events} events, one per line.`,
    availability: (w) =>
      `The file can be downloaded until ${w.until}; after that it is deleted. Download it from the ` +
      'dashboard, signed in as the owner of the account.',
    download: 'Download the file',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason: 'You received this email because you asked for an export of a Pyxis project.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: (w) => `A exportação de ${w.project} está pronta`,
    preheader: (w) => `${w.events} eventos, para baixar até ${w.until}.`,
    heading: 'Exportação pronta',
    contents: (w) =>
      `Os eventos de ${w.project} estão num arquivo CSV compactado: ${w.events} eventos, um por ` +
      'linha.',
    availability: (w) =>
      `O arquivo fica disponível até ${w.until}; depois disso, é apagado. Baixe pelo painel, ` +
      'entrando com a conta do responsável.',
    download: 'Baixar o arquivo',
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason: 'Você recebeu este e-mail porque pediu a exportação de um projeto do Pyxis.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    subject: (w) => `La exportación de ${w.project} está lista`,
    preheader: (w) => `${w.events} eventos, para descargar hasta el ${w.until}.`,
    heading: 'Exportación lista',
    contents: (w) =>
      `Los eventos de ${w.project} están en un archivo CSV comprimido: ${w.events} eventos, uno ` +
      'por línea.',
    availability: (w) =>
      `El archivo está disponible hasta el ${w.until}; después se elimina. Descárgalo desde el ` +
      'panel, entrando con la cuenta del titular.',
    download: 'Descargar el archivo',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: 'Recibiste este correo porque pediste la exportación de un proyecto de Pyxis.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    subject: (w) => `Dein Export von ${w.project} ist fertig`,
    preheader: (w) => `${w.events} Ereignisse, herunterladbar bis zum ${w.until}.`,
    heading: 'Export fertig',
    contents: (w) =>
      `Die Ereignisse von ${w.project} liegen in einer komprimierten CSV-Datei: ${w.events} ` +
      'Ereignisse, eines pro Zeile.',
    availability: (w) =>
      `Die Datei kann bis zum ${w.until} heruntergeladen werden; danach wird sie gelöscht. Lade ` +
      `sie ` +
      'im Dashboard herunter, angemeldet als Inhaber des Kontos.',
    download: 'Datei herunterladen',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason:
      'Du hast diese E-Mail bekommen, weil du einen Export eines Pyxis-Projekts angefordert hast.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    subject: (w) => `Votre export de ${w.project} est prêt`,
    preheader: (w) => `${w.events} événements, à télécharger jusqu’au ${w.until}.`,
    heading: 'Export prêt',
    contents: (w) =>
      `Les événements de ${w.project} sont dans un fichier CSV compressé\u00a0: ${w.events} ` +
      'événements, un par ligne.',
    availability: (w) =>
      `Le fichier peut être téléchargé jusqu’au ${w.until}\u202f; il est ensuite supprimé. ` +
      'Téléchargez-le depuis le tableau de bord, en vous connectant en tant que propriétaire du ' +
      'compte.',
    download: 'Télécharger le fichier',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason: 'Vous recevez cet e-mail parce que vous avez demandé l’export d’un projet Pyxis.',
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    subject: (w) => `L’esportazione di ${w.project} è pronta`,
    preheader: (w) => `${w.events} eventi, da scaricare entro il giorno ${w.until}.`,
    heading: 'Esportazione pronta',
    contents: (w) =>
      `Gli eventi di ${w.project} sono in un file CSV compresso: ${w.events} eventi, uno per ` +
      'riga.',
    availability: (w) =>
      `Il file si può scaricare fino al giorno ${w.until}; dopo viene eliminato. Scaricalo dalla ` +
      'dashboard, con l’accesso del proprietario dell’account.',
    download: 'Scarica il file',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason: 'Hai ricevuto questa email perché hai richiesto l’esportazione di un progetto Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    subject: (w) => `Je export van ${w.project} is klaar`,
    preheader: (w) => `${w.events} events, te downloaden tot ${w.until}.`,
    heading: 'Export klaar',
    contents: (w) =>
      `De events van ${w.project} staan in een gecomprimeerd CSV-bestand: ${w.events} events, ` +
      'één per regel.',
    availability: (w) =>
      `Het bestand is te downloaden tot ${w.until}; daarna wordt het verwijderd. Download het ` +
      `via ` +
      'het dashboard, ingelogd als eigenaar van het account.',
    download: 'Bestand downloaden',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: 'Je ontvangt deze e-mail omdat je een export van een Pyxis-project hebt aangevraagd.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
