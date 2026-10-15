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
};
