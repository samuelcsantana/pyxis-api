import type { AccountNoticeKind } from '../../domain/accounts/account-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface AccountNoticeWords {
  readonly deletionOn: string;
}

export interface AccountNoticeCopy {
  readonly subject: (words: AccountNoticeWords) => string;
  readonly preheader: (words: AccountNoticeWords) => string;
  readonly heading: (words: AccountNoticeWords) => string;
  readonly paragraphs: (words: AccountNoticeWords) => readonly string[];
}

export interface AccountNoticeEmailMessages {
  readonly language: EmailLanguage;
  readonly notices: Readonly<Record<AccountNoticeKind, AccountNoticeCopy>>;
  readonly support: (address: string) => string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const ACCOUNT_NOTICE_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, AccountNoticeEmailMessages>
> = {
  en: {
    language: 'en',
    notices: {
      access_ended: {
        subject: () => 'Your Pyxis subscription has ended',
        preheader: (w) => `Your sites no longer send events. The data stays until ${w.deletionOn}.`,
        heading: () => 'Subscription ended',
        paragraphs: (w) => [
          'Your account’s subscription has ended, so its keys were revoked and your sites no ' +
            'longer send events to Pyxis.',
          `The reports stay readable until ${w.deletionOn}. On that day the projects, their ` +
            'events and their keys are deleted for good.',
          'To keep the data, export it from the account page before then, or subscribe again to ' +
            'keep measuring.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Your Pyxis data will be deleted on ${w.deletionOn}`,
        preheader: () => 'Export it or subscribe again before then to keep it.',
        heading: (w) => `Deletion on ${w.deletionOn}`,
        paragraphs: (w) => [
          `On ${w.deletionOn}, the projects of your Pyxis account, with their events and their ` +
            'keys, will be deleted for good.',
          'To keep the data, export it from the account page or subscribe again before then.',
        ],
      },
      account_deleted: {
        subject: () => 'Your Pyxis account was deleted',
        preheader: () => 'Its projects, their events and their keys are gone.',
        heading: () => 'Account deleted',
        paragraphs: () => [
          'As announced, your Pyxis account was deleted with its projects, their events and ' +
            'their keys. Nothing of them is left in Pyxis.',
          'To measure your sites again, you can create a new account at any time.',
        ],
      },
    },
    support: (address) => `To ask anything, reply to this email or write to ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason: 'You received this email because you own a Pyxis account.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    notices: {
      access_ended: {
        subject: () => 'Sua assinatura do Pyxis terminou',
        preheader: (w) => `Seus sites não enviam mais eventos. Os dados ficam até ${w.deletionOn}.`,
        heading: () => 'Assinatura encerrada',
        paragraphs: (w) => [
          'A assinatura da sua conta terminou: as chaves foram revogadas e seus sites não ' +
            'enviam mais eventos ao Pyxis.',
          `Os relatórios continuam disponíveis até ${w.deletionOn}. Nesse dia, os projetos, os ` +
            'eventos e as chaves são apagados de vez.',
          'Para guardar os dados, exporte-os pela página da conta antes disso, ou assine de novo ' +
            'para continuar medindo.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Seus dados no Pyxis serão apagados em ${w.deletionOn}`,
        preheader: () => 'Exporte-os ou assine de novo antes disso para guardá-los.',
        heading: (w) => `Exclusão em ${w.deletionOn}`,
        paragraphs: (w) => [
          `Em ${w.deletionOn}, os projetos da sua conta do Pyxis, com os eventos e as chaves, ` +
            'serão apagados de vez.',
          'Para guardar os dados, exporte-os pela página da conta ou assine de novo antes disso.',
        ],
      },
      account_deleted: {
        subject: () => 'Sua conta do Pyxis foi apagada',
        preheader: () => 'Os projetos, os eventos e as chaves não existem mais.',
        heading: () => 'Conta apagada',
        paragraphs: () => [
          'Como avisado, sua conta do Pyxis foi apagada com os projetos, os eventos e as ' +
            'chaves. Nada deles ficou no Pyxis.',
          'Para medir seus sites de novo, você pode criar outra conta quando quiser.',
        ],
      },
    },
    support: (address) =>
      `Para perguntar qualquer coisa, responda a este e-mail ou escreva para ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason: 'Você recebeu este e-mail porque é o responsável por uma conta do Pyxis.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    notices: {
      access_ended: {
        subject: () => 'Tu suscripción a Pyxis terminó',
        preheader: (w) =>
          `Tus sitios ya no envían eventos. Los datos se conservan hasta el ${w.deletionOn}.`,
        heading: () => 'Suscripción terminada',
        paragraphs: (w) => [
          'La suscripción de tu cuenta terminó: sus claves se revocaron y tus sitios ya no ' +
            'envían eventos a Pyxis.',
          `Los informes siguen disponibles hasta el ${w.deletionOn}. Ese día, los proyectos, ` +
            'sus eventos y sus claves se eliminan definitivamente.',
          'Para conservar los datos, expórtalos desde la página de la cuenta antes de esa fecha, ' +
            'o suscríbete de nuevo para seguir midiendo.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Tus datos en Pyxis se eliminarán el ${w.deletionOn}`,
        preheader: () => 'Expórtalos o suscríbete de nuevo antes de esa fecha para conservarlos.',
        heading: (w) => `Eliminación el ${w.deletionOn}`,
        paragraphs: (w) => [
          `El ${w.deletionOn}, los proyectos de tu cuenta de Pyxis, con sus eventos y sus ` +
            'claves, se eliminarán definitivamente.',
          'Para conservar los datos, expórtalos desde la página de la cuenta o suscríbete de ' +
            'nuevo antes de esa fecha.',
        ],
      },
      account_deleted: {
        subject: () => 'Tu cuenta de Pyxis se eliminó',
        preheader: () => 'Sus proyectos, sus eventos y sus claves ya no existen.',
        heading: () => 'Cuenta eliminada',
        paragraphs: () => [
          'Como te avisamos, tu cuenta de Pyxis se eliminó con sus proyectos, sus eventos y sus ' +
            'claves. No queda nada de ellos en Pyxis.',
          'Para volver a medir tus sitios, puedes crear una cuenta nueva cuando quieras.',
        ],
      },
    },
    support: (address) =>
      `Para preguntar lo que sea, responde a este correo o escribe a ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: 'Recibiste este correo porque eres el titular de una cuenta de Pyxis.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
};
