import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface InvitationWords {
  readonly project: string;
  readonly inviter: string;
}

export interface InvitationEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: (words: InvitationWords) => string;
  readonly preheader: (words: InvitationWords) => string;
  readonly heading: (words: InvitationWords) => string;
  readonly added: (words: InvitationWords) => string;
  readonly howToSignIn: string;
  readonly openDashboard: string;
  readonly notExpected: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const INVITATION_EMAIL_MESSAGES: Readonly<Record<EmailLanguage, InvitationEmailMessages>> = {
  en: {
    language: 'en',
    subject: (w) => `${w.inviter} added you to ${w.project} on Pyxis`,
    preheader: (w) => `Sign in with this address to see the reports of ${w.project}.`,
    heading: (w) => `You can now see ${w.project}`,
    added: (w) =>
      `${w.inviter} added you to the project ${w.project} on Pyxis. You can read its ` +
      'reports; only the owner of the account changes its settings.',
    howToSignIn:
      'There is no password: open the dashboard, type this address and a sign-in code arrives ' +
      'by email.',
    openDashboard: 'Open the dashboard',
    notExpected:
      'Don’t know who sent this? You can ignore this email: no one can sign in without the ' +
      'code sent to this address.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason:
      'You received this email because the owner of a Pyxis account added this address to one ' +
      'of its projects.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: (w) => `${w.inviter} adicionou você ao projeto ${w.project} no Pyxis`,
    preheader: (w) => `Entre com este endereço para ver os relatórios de ${w.project}.`,
    heading: (w) => `Você agora tem acesso a ${w.project}`,
    added: (w) =>
      `${w.inviter} adicionou você ao projeto ${w.project} no Pyxis. Você pode ler os ` +
      'relatórios; só o responsável pela conta muda as configurações.',
    howToSignIn:
      'Não há senha: abra o painel, digite este endereço e um código de acesso chega por ' +
      'e-mail.',
    openDashboard: 'Abrir o painel',
    notExpected:
      'Não sabe quem mandou? Pode ignorar este e-mail: ninguém entra sem o código enviado a ' +
      'este endereço.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason:
      'Você recebeu este e-mail porque o responsável por uma conta do Pyxis adicionou este ' +
      'endereço a um dos projetos dela.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    subject: (w) => `${w.inviter} te agregó al proyecto ${w.project} en Pyxis`,
    preheader: (w) => `Entra con esta dirección para ver los informes de ${w.project}.`,
    heading: (w) => `Ahora tienes acceso a ${w.project}`,
    added: (w) =>
      `${w.inviter} te agregó al proyecto ${w.project} en Pyxis. Puedes leer sus informes; ` +
      'solo el titular de la cuenta cambia su configuración.',
    howToSignIn:
      'No hay contraseña: abre el panel, escribe esta dirección y te llegará un código de ' +
      'acceso por correo.',
    openDashboard: 'Abrir el panel',
    notExpected:
      '¿No sabes quién lo envió? Puedes ignorar este correo: nadie entra sin el código enviado ' +
      'a esta dirección.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason:
      'Recibiste este correo porque el titular de una cuenta de Pyxis agregó esta dirección a ' +
      'uno de sus proyectos.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
};
