import type { QuotaWarningPercent } from '../../domain/accounts/quota-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface QuotaWarningWords {
  readonly percent: string;
  readonly events: string;
  readonly limit: string;
  readonly month: string;
  readonly measuredOn: string;
}

export interface QuotaPauseWords {
  readonly pauseAtEvents: string;
  readonly pauseUntil: string;
}

export interface QuotaPausedWords {
  readonly events: string;
  readonly limit: string;
  readonly month: string;
  readonly resumesOn: string;
}

export interface QuotaNoticeEmailMessages {
  readonly language: EmailLanguage;
  readonly warningSubject: (words: QuotaWarningWords) => string;
  readonly warningPreheader: (words: QuotaWarningWords) => string;
  readonly warningHeading: (words: QuotaWarningWords) => string;
  readonly warningCount: (words: QuotaWarningWords) => string;
  readonly warningCarriesOn: Readonly<Record<QuotaWarningPercent, string>>;
  readonly warningPause: (words: QuotaPauseWords) => string;
  readonly pausedSubject: (words: QuotaPausedWords) => string;
  readonly pausedPreheader: (words: QuotaPausedWords) => string;
  readonly pausedHeading: string;
  readonly pausedCount: (words: QuotaPausedWords) => string;
  readonly pausedEffect: (words: QuotaPausedWords) => string;
  readonly support: (address: string) => string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const QUOTA_NOTICE_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, QuotaNoticeEmailMessages>
> = {
  en: {
    language: 'en',
    warningSubject: (w) => `Your Pyxis account used ${w.percent} of ${w.month}’s events`,
    warningPreheader: (w) => `${w.events} of ${w.limit} events so far. Nothing is cut off.`,
    warningHeading: (w) => `${w.percent} of this month’s events`,
    warningCount: (w) =>
      `Your account received ${w.events} of its ${w.limit} events in ${w.month}, counted on ${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Nothing changes yet: your sites keep sending events as usual.',
      100: 'Nothing is cut off: your sites keep sending events as usual.',
    },
    warningPause: (w) =>
      `If the account reaches ${w.pauseAtEvents} events this month (150% of the plan), measuring ` +
      `pauses until ${w.pauseUntil} and the events sent meanwhile are dropped.`,
    pausedSubject: (w) => `Pyxis paused measuring your sites until ${w.resumesOn}`,
    pausedPreheader: (w) =>
      `Your account received ${w.events} events in ${w.month}, 150% of the plan.`,
    pausedHeading: 'Measuring is paused',
    pausedCount: (w) =>
      `Your account received ${w.events} events in ${w.month}, 150% of the ${w.limit} in its plan.`,
    pausedEffect: (w) =>
      `Until ${w.resumesOn}, the events your sites send are dropped and will not appear in the ` +
      'dashboard. Measuring resumes on its own then.',
    support: (address) =>
      `To talk about a larger plan, reply to this e-mail or write to ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason: 'You received this e-mail because you own a Pyxis account.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    warningSubject: (w) => `Sua conta do Pyxis usou ${w.percent} dos eventos de ${w.month}`,
    warningPreheader: (w) => `${w.events} de ${w.limit} eventos até agora. Nada é cortado.`,
    warningHeading: (w) => `${w.percent} dos eventos deste mês`,
    warningCount: (w) =>
      `Sua conta recebeu ${w.events} dos ${w.limit} eventos do plano em ${w.month}, contados em ${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Nada muda por enquanto: seus sites continuam enviando eventos normalmente.',
      100: 'Nada é cortado: seus sites continuam enviando eventos normalmente.',
    },
    warningPause: (w) =>
      `Se a conta chegar a ${w.pauseAtEvents} eventos neste mês (150% do plano), a medição pausa ` +
      `até ${w.pauseUntil} e os eventos enviados nesse meio-tempo são descartados.`,
    pausedSubject: (w) => `O Pyxis pausou a medição dos seus sites até ${w.resumesOn}`,
    pausedPreheader: (w) => `Sua conta recebeu ${w.events} eventos em ${w.month}, 150% do plano.`,
    pausedHeading: 'Medição pausada',
    pausedCount: (w) =>
      `Sua conta recebeu ${w.events} eventos em ${w.month}, 150% dos ${w.limit} do plano.`,
    pausedEffect: (w) =>
      `Até ${w.resumesOn}, os eventos que seus sites enviarem são descartados e não aparecem no ` +
      'painel. A medição volta sozinha nessa data.',
    support: (address) =>
      `Para conversar sobre um plano maior, responda a este e-mail ou escreva para ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason: 'Você recebeu este e-mail porque é o responsável por uma conta do Pyxis.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    warningSubject: (w) => `Tu cuenta de Pyxis usó el ${w.percent} de los eventos de ${w.month}`,
    warningPreheader: (w) => `${w.events} de ${w.limit} eventos hasta ahora. No se corta nada.`,
    warningHeading: (w) => `El ${w.percent} de los eventos de este mes`,
    warningCount: (w) =>
      `Tu cuenta recibió ${w.events} de sus ${w.limit} eventos en ${w.month}, contados el ${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Por ahora nada cambia: tus sitios siguen enviando eventos con normalidad.',
      100: 'No se corta nada: tus sitios siguen enviando eventos con normalidad.',
    },
    warningPause: (w) =>
      `Si la cuenta llega a ${w.pauseAtEvents} eventos este mes (el 150\u00a0% del plan), la medición se ` +
      `pausa hasta el ${w.pauseUntil} y los eventos enviados mientras tanto se descartan.`,
    pausedSubject: (w) => `Pyxis pausó la medición de tus sitios hasta el ${w.resumesOn}`,
    pausedPreheader: (w) =>
      `Tu cuenta recibió ${w.events} eventos en ${w.month}, el 150\u00a0% del plan.`,
    pausedHeading: 'Medición en pausa',
    pausedCount: (w) =>
      `Tu cuenta recibió ${w.events} eventos en ${w.month}, el 150\u00a0% de los ${w.limit} del plan.`,
    pausedEffect: (w) =>
      `Hasta el ${w.resumesOn}, los eventos que envíen tus sitios se descartan y no aparecen en el ` +
      'panel. La medición se reanuda sola en esa fecha.',
    support: (address) =>
      `Para hablar de un plan más grande, responde a este correo o escribe a ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: 'Recibiste este correo porque eres el titular de una cuenta de Pyxis.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
};
