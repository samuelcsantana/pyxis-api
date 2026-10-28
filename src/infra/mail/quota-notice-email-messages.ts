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

export interface FreeQuotaNoticeMessages {
  readonly warningPause: (words: QuotaPauseWords) => string;
  readonly warningSubscribe: string;
  readonly pausedPreheader: (words: QuotaPausedWords) => string;
  readonly pausedCount: (words: QuotaPausedWords) => string;
  readonly pausedSubscribe: string;
  readonly accountLink: string;
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
  readonly free: FreeQuotaNoticeMessages;
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
    free: {
      warningPause: (w) =>
        `If the account reaches ${w.pauseAtEvents} events this month, the free plan’s limit, measuring pauses until ${w.pauseUntil} and the events sent meanwhile are dropped.`,
      warningSubscribe: 'To keep measuring past it, subscribe in Account and billing.',
      pausedPreheader: (w) =>
        `Your account received ${w.events} events in ${w.month}, the free plan’s limit.`,
      pausedCount: (w) =>
        `Your account received ${w.events} events in ${w.month}, the ${w.limit} of the free plan.`,
      pausedSubscribe:
        'To measure again before then, subscribe in Account and billing: measuring resumes within a minute.',
      accountLink: 'Account and billing',
    },
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
    free: {
      warningPause: (w) =>
        `Se a conta chegar a ${w.pauseAtEvents} eventos neste mês, o limite do plano grátis, a medição pausa até ${w.pauseUntil} e os eventos enviados nesse meio-tempo são descartados.`,
      warningSubscribe: 'Para continuar medindo depois disso, assine em Conta e cobrança.',
      pausedPreheader: (w) =>
        `Sua conta recebeu ${w.events} eventos em ${w.month}, o limite do plano grátis.`,
      pausedCount: (w) =>
        `Sua conta recebeu ${w.events} eventos em ${w.month}, os ${w.limit} do plano grátis.`,
      pausedSubscribe:
        'Para voltar a medir antes disso, assine em Conta e cobrança: a medição volta em até um minuto.',
      accountLink: 'Conta e cobrança',
    },
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
    free: {
      warningPause: (w) =>
        `Si la cuenta llega a ${w.pauseAtEvents} eventos este mes, el límite del plan gratis, la medición se pausa hasta el ${w.pauseUntil} y los eventos enviados mientras tanto se descartan.`,
      warningSubscribe: 'Para seguir midiendo después, suscríbete en Cuenta y facturación.',
      pausedPreheader: (w) =>
        `Tu cuenta recibió ${w.events} eventos en ${w.month}, el límite del plan gratis.`,
      pausedCount: (w) =>
        `Tu cuenta recibió ${w.events} eventos en ${w.month}, los ${w.limit} del plan gratis.`,
      pausedSubscribe:
        'Para volver a medir antes, suscríbete en Cuenta y facturación: la medición se reanuda en menos de un minuto.',
      accountLink: 'Cuenta y facturación',
    },
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: 'Recibiste este correo porque eres el titular de una cuenta de Pyxis.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    warningSubject: (w) =>
      `Dein Pyxis-Konto hat ${w.percent} der Ereignisse für ${w.month} verbraucht`,
    warningPreheader: (w) =>
      `Bisher ${w.events} von ${w.limit} Ereignissen. Es wird nichts abgeschaltet.`,
    warningHeading: (w) => `${w.percent} der Ereignisse dieses Monats`,
    warningCount: (w) =>
      `Dein Konto hat im ${w.month} ${w.events} seiner ${w.limit} Ereignisse empfangen, Stand ` +
      `${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Noch ändert sich nichts: Deine Websites senden wie gewohnt Ereignisse.',
      100: 'Es wird nichts abgeschaltet: Deine Websites senden wie gewohnt Ereignisse.',
    },
    warningPause: (w) =>
      `Erreicht das Konto in diesem Monat ${w.pauseAtEvents} Ereignisse (150\u00a0% des Plans), ` +
      `wird ` +
      `die Messung bis zum ${w.pauseUntil} pausiert, und die in der Zwischenzeit gesendeten ` +
      'Ereignisse werden verworfen.',
    pausedSubject: (w) => `Pyxis hat die Messung deiner Websites bis zum ${w.resumesOn} pausiert`,
    pausedPreheader: (w) =>
      `Dein Konto hat im ${w.month} ${w.events} Ereignisse empfangen, 150\u00a0% des Plans.`,
    pausedHeading: 'Die Messung ist pausiert',
    pausedCount: (w) =>
      `Dein Konto hat im ${w.month} ${w.events} Ereignisse empfangen, 150\u00a0% der ${w.limit} ` +
      'in seinem Plan.',
    pausedEffect: (w) =>
      `Bis zum ${w.resumesOn} werden die Ereignisse, die deine Websites senden, verworfen und ` +
      'erscheinen nicht im Dashboard. Danach läuft die Messung von selbst wieder an.',
    support: (address) =>
      `Um über einen größeren Plan zu sprechen, antworte auf diese E-Mail oder schreib an ` +
      `${address}.`,
    free: {
      warningPause: (w) =>
        `Erreicht das Konto in diesem Monat ${w.pauseAtEvents} Ereignisse, die Grenze des kostenlosen Plans, wird die Messung bis zum ${w.pauseUntil} pausiert, und die in der Zwischenzeit gesendeten Ereignisse werden verworfen.`,
      warningSubscribe:
        'Um danach weiter zu messen, schließ unter „Konto und Abrechnung“ ein Abo ab.',
      pausedPreheader: (w) =>
        `Dein Konto hat im ${w.month} ${w.events} Ereignisse empfangen, die Grenze des kostenlosen Plans.`,
      pausedCount: (w) =>
        `Dein Konto hat im ${w.month} ${w.events} Ereignisse empfangen, die ${w.limit} des kostenlosen Plans.`,
      pausedSubscribe:
        'Um schon vorher wieder zu messen, schließ unter „Konto und Abrechnung“ ein Abo ab: Die Messung läuft innerhalb einer Minute wieder an.',
      accountLink: 'Konto und Abrechnung',
    },
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason: 'Du hast diese E-Mail bekommen, weil du Inhaber eines Pyxis-Kontos bist.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    warningSubject: (w) =>
      `Votre compte Pyxis a utilisé ${w.percent} de ses événements mensuels ` + `en ${w.month}`,
    warningPreheader: (w) =>
      `${w.events} événements sur ${w.limit} jusqu’ici. Rien n’est interrompu.`,
    warningHeading: (w) => `${w.percent} des événements de ce mois-ci`,
    warningCount: (w) =>
      `Votre compte a reçu ${w.events} de ses ${w.limit} événements en ${w.month}, comptés le ` +
      `${w.measuredOn}.`,
    warningCarriesOn: {
      80:
        'Rien ne change pour l’instant : vos sites continuent d’envoyer des événements ' +
        'normalement.',
      100: 'Rien n’est interrompu : vos sites continuent d’envoyer des événements normalement.',
    },
    warningPause: (w) =>
      `Si le compte atteint ${w.pauseAtEvents} événements ce mois-ci (150\u202f% de la formule), ` +
      `la mesure est mise en pause jusqu’au ${w.pauseUntil} et les événements envoyés ` +
      `entre-temps ` +
      'sont perdus.',
    pausedSubject: (w) => `Pyxis a mis en pause la mesure de vos sites jusqu’au ${w.resumesOn}`,
    pausedPreheader: (w) =>
      `Votre compte a reçu ${w.events} événements en ${w.month}, soit 150\u202f% de la formule.`,
    pausedHeading: 'La mesure est en pause',
    pausedCount: (w) =>
      `Votre compte a reçu ${w.events} événements en ${w.month}, soit 150\u202f% des ${w.limit} ` +
      'prévus par sa formule.',
    pausedEffect: (w) =>
      `Jusqu’au ${w.resumesOn}, les événements envoyés par vos sites sont perdus et ` +
      `n’apparaîtront ` +
      'pas dans le tableau de bord. La mesure reprendra ensuite d’elle-même.',
    support: (address) =>
      `Pour parler d’une formule supérieure, répondez à cet e-mail ou écrivez à ${address}.`,
    free: {
      warningPause: (w) =>
        `Si le compte atteint ${w.pauseAtEvents} événements ce mois-ci, la limite de la formule gratuite, la mesure est mise en pause jusqu’au ${w.pauseUntil} et les événements envoyés entre-temps sont perdus.`,
      warningSubscribe:
        'Pour continuer la mesure au-delà, abonnez-vous depuis Compte et facturation.',
      pausedPreheader: (w) =>
        `Votre compte a reçu ${w.events} événements en ${w.month}, soit la limite de la formule gratuite.`,
      pausedCount: (w) =>
        `Votre compte a reçu ${w.events} événements en ${w.month}, soit les ${w.limit} prévus par la formule gratuite.`,
      pausedSubscribe:
        'Pour reprendre la mesure plus tôt, abonnez-vous depuis Compte et facturation\u00a0: la mesure reprend en moins d’une minute.',
      accountLink: 'Compte et facturation',
    },
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason: 'Vous recevez cet e-mail parce que vous êtes propriétaire d’un compte Pyxis.',
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    warningSubject: (w) =>
      `Il tuo account Pyxis ha raggiunto quota ${w.percent} degli eventi di ${w.month}`,
    warningPreheader: (w) => `${w.events} eventi su ${w.limit} finora. Non viene bloccato nulla.`,
    warningHeading: (w) => `${w.percent} degli eventi di questo mese`,
    warningCount: (w) =>
      `Il tuo account ha ricevuto ${w.events} dei suoi ${w.limit} eventi di ${w.month}, ` +
      `conteggio del giorno ${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Per ora non cambia nulla: i tuoi siti continuano a inviare eventi come sempre.',
      100: 'Non viene bloccato nulla: i tuoi siti continuano a inviare eventi come sempre.',
    },
    warningPause: (w) =>
      `Se l’account arriva a ${w.pauseAtEvents} eventi questo mese (il 150% del piano), la ` +
      `misurazione va in pausa fino al giorno ${w.pauseUntil} e gli eventi inviati nel frattempo ` +
      'vengono scartati.',
    pausedSubject: (w) =>
      `Pyxis ha messo in pausa la misurazione dei tuoi siti fino al giorno ${w.resumesOn}`,
    pausedPreheader: (w) =>
      `Il tuo account ha ricevuto ${w.events} eventi a ${w.month}, il 150% del piano.`,
    pausedHeading: 'Misurazione in pausa',
    pausedCount: (w) =>
      `Il tuo account ha ricevuto ${w.events} eventi a ${w.month}, il 150% dei ${w.limit} ` +
      `previsti dal piano.`,
    pausedEffect: (w) =>
      `Fino al giorno ${w.resumesOn}, gli eventi inviati dai tuoi siti vengono scartati e non ` +
      'compariranno nella dashboard. Da quel giorno la misurazione riprende da sola.',
    support: (address) =>
      `Per parlare di un piano più grande, rispondi a questa email o scrivi a ${address}.`,
    free: {
      warningPause: (w) =>
        `Se l’account arriva a ${w.pauseAtEvents} eventi questo mese, il limite del piano gratuito, la misurazione va in pausa fino al giorno ${w.pauseUntil} e gli eventi inviati nel frattempo vengono scartati.`,
      warningSubscribe: 'Per continuare a misurare oltre, abbonati da Account e fatturazione.',
      pausedPreheader: (w) =>
        `Il tuo account ha ricevuto ${w.events} eventi a ${w.month}, il limite del piano gratuito.`,
      pausedCount: (w) =>
        `Il tuo account ha ricevuto ${w.events} eventi a ${w.month}, i ${w.limit} previsti dal piano gratuito.`,
      pausedSubscribe:
        'Per tornare a misurare prima, abbonati da Account e fatturazione: la misurazione riprende entro un minuto.',
      accountLink: 'Account e fatturazione',
    },
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason: 'Hai ricevuto questa email perché possiedi un account Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    warningSubject: (w) =>
      `Je Pyxis-account heeft ${w.percent} van de events van ${w.month} gebruikt`,
    warningPreheader: (w) =>
      `${w.events} van ${w.limit} events tot nu toe. Er wordt niets afgesloten.`,
    warningHeading: (w) => `${w.percent} van de events van deze maand`,
    warningCount: (w) =>
      `Je account heeft in ${w.month} ${w.events} van de ${w.limit} events ontvangen, geteld op ` +
      `${w.measuredOn}.`,
    warningCarriesOn: {
      80: 'Er verandert nog niets: je sites blijven gewoon events versturen.',
      100: 'Er wordt niets afgesloten: je sites blijven gewoon events versturen.',
    },
    warningPause: (w) =>
      `Bereikt het account deze maand ${w.pauseAtEvents} events (150% van het abonnement), dan ` +
      `wordt het meten gepauzeerd tot ${w.pauseUntil} en worden de events die in de tussentijd ` +
      'worden verstuurd weggegooid.',
    pausedSubject: (w) => `Pyxis heeft het meten van je sites gepauzeerd tot ${w.resumesOn}`,
    pausedPreheader: (w) =>
      `Je account heeft in ${w.month} ${w.events} events ontvangen, 150% van het abonnement.`,
    pausedHeading: 'Het meten is gepauzeerd',
    pausedCount: (w) =>
      `Je account heeft in ${w.month} ${w.events} events ontvangen, 150% van de ${w.limit} in ` +
      `het abonnement.`,
    pausedEffect: (w) =>
      `Tot ${w.resumesOn} worden de events die je sites versturen weggegooid en verschijnen ze ` +
      'niet in het dashboard. Daarna wordt het meten vanzelf hervat.',
    support: (address) =>
      `Wil je het over een groter abonnement hebben? Beantwoord deze e-mail of mail naar ` +
      `${address}.`,
    free: {
      warningPause: (w) =>
        `Bereikt het account deze maand ${w.pauseAtEvents} events, de limiet van het gratis abonnement, dan wordt het meten gepauzeerd tot ${w.pauseUntil} en worden de events die in de tussentijd worden verstuurd weggegooid.`,
      warningSubscribe:
        'Wil je daarna blijven meten? Neem een abonnement via Account en facturatie.',
      pausedPreheader: (w) =>
        `Je account heeft in ${w.month} ${w.events} events ontvangen, de limiet van het gratis abonnement.`,
      pausedCount: (w) =>
        `Je account heeft in ${w.month} ${w.events} events ontvangen, de ${w.limit} van het gratis abonnement.`,
      pausedSubscribe:
        'Wil je eerder weer meten? Neem een abonnement via Account en facturatie: het meten wordt binnen een minuut hervat.',
      accountLink: 'Account en facturatie',
    },
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: 'Je ontvangt deze e-mail omdat je eigenaar bent van een Pyxis-account.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
