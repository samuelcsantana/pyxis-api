import type { AccountNoticeKind } from '../../domain/accounts/account-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export const NO_REFUND = '';

export interface AccountNoticeWords {
  readonly deletionOn: string;
  readonly refunded: string;
  readonly monthlyEvents: string;
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
      withdrawn_to_free: {
        subject: () => 'You withdrew from the Pyxis paid plan',
        preheader: () => 'Your account is back on the free plan.',
        heading: () => 'Back on the free plan',
        paragraphs: (w) => [
          'Your paid subscription was cancelled at once, and your account is back on the free plan, with its projects and data.',
          w.refunded === NO_REFUND
            ? 'The automatic refund of the first payment did not go through: we are making it by hand within 2 business days and will write to you.'
            : `${w.refunded} was refunded to your card. It shows on your statement within the time your card company takes.`,
          'The free plan’s limits apply again from now; the account page shows them.',
        ],
      },
      back_to_free: {
        subject: () => 'Your Pyxis account is back on the free plan',
        preheader: () =>
          'Your subscription ended. Your sites keep sending events, within the free plan.',
        heading: () => 'Back on the free plan',
        paragraphs: (w) => [
          'Your paid subscription has ended, and your account is back on the free plan, with its projects, their data and their keys: your sites keep sending events to Pyxis.',
          `The free plan measures up to ${w.monthlyEvents} events a month. If this month has already reached that, measuring pauses until the 1st and then comes back on its own.`,
          'To measure more, subscribe again from the account page. To leave Pyxis instead, close the account there.',
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
      withdrawn_to_free: {
        subject: () => 'Você desistiu do plano pago do Pyxis',
        preheader: () => 'Sua conta voltou ao plano grátis.',
        heading: () => 'De volta ao plano grátis',
        paragraphs: (w) => [
          'Sua assinatura foi cancelada na hora, e sua conta voltou ao plano grátis, com os projetos e os dados.',
          w.refunded === NO_REFUND
            ? 'O estorno automático do primeiro pagamento não deu certo: vamos fazê-lo à mão em até 2 dias úteis e avisar você.'
            : `${w.refunded} foram devolvidos ao seu cartão. O valor aparece na fatura no prazo da administradora do cartão.`,
          'Os limites do plano grátis voltam a valer a partir de agora; a página da conta mostra quais são.',
        ],
      },
      back_to_free: {
        subject: () => 'Sua conta do Pyxis voltou ao plano grátis',
        preheader: () =>
          'Sua assinatura terminou. Seus sites continuam enviando eventos, dentro do plano grátis.',
        heading: () => 'De volta ao plano grátis',
        paragraphs: (w) => [
          'Sua assinatura paga terminou, e sua conta voltou ao plano grátis, com os projetos, os dados e as chaves: seus sites continuam enviando eventos ao Pyxis.',
          `O plano grátis mede até ${w.monthlyEvents} eventos por mês. Se este mês já chegou a esse número, a medição pausa até o dia 1º e depois volta sozinha.`,
          'Para medir mais, assine de novo pela página da conta. Se preferir sair do Pyxis, encerre a conta por lá.',
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
      withdrawn_to_free: {
        subject: () => 'Desististe del plan de pago de Pyxis',
        preheader: () => 'Tu cuenta volvió al plan gratis.',
        heading: () => 'De vuelta al plan gratis',
        paragraphs: (w) => [
          'Tu suscripción se canceló de inmediato y tu cuenta volvió al plan gratis, con sus proyectos y sus datos.',
          w.refunded === NO_REFUND
            ? 'La devolución automática del primer pago no se completó: la haremos a mano en un plazo de 2 días hábiles y te escribiremos.'
            : `Se devolvieron ${w.refunded} a tu tarjeta. Aparece en tu extracto en el plazo de la emisora de la tarjeta.`,
          'Los límites del plan gratis vuelven a aplicarse desde ahora; la página de la cuenta los muestra.',
        ],
      },
      back_to_free: {
        subject: () => 'Tu cuenta de Pyxis volvió al plan gratis',
        preheader: () =>
          'Tu suscripción terminó. Tus sitios siguen enviando eventos, dentro del plan gratis.',
        heading: () => 'De vuelta al plan gratis',
        paragraphs: (w) => [
          'Tu suscripción de pago terminó y tu cuenta volvió al plan gratis, con sus proyectos, sus datos y sus claves: tus sitios siguen enviando eventos a Pyxis.',
          `El plan gratis mide hasta ${w.monthlyEvents} eventos al mes. Si este mes ya llegó a esa cifra, la medición se pausa hasta el día 1 y luego vuelve sola.`,
          'Para medir más, suscríbete de nuevo desde la página de la cuenta. Si prefieres dejar Pyxis, cierra la cuenta allí.',
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
  de: {
    language: 'de',
    notices: {
      access_ended: {
        subject: () => 'Dein Pyxis-Abo ist beendet',
        preheader: (w) =>
          `Deine Websites senden keine Ereignisse mehr. Die Daten bleiben bis zum ${w.deletionOn}.`,
        heading: () => 'Abo beendet',
        paragraphs: (w) => [
          'Das Abo deines Kontos ist beendet: Seine Schlüssel wurden widerrufen, und deine ' +
            'Websites senden keine Ereignisse mehr an Pyxis.',
          `Die Berichte bleiben bis zum ${w.deletionOn} lesbar. An diesem Tag werden die ` +
            `Projekte, ` +
            'ihre Ereignisse und ihre Schlüssel endgültig gelöscht.',
          'Um die Daten zu behalten, exportiere sie vorher auf der Kontoseite oder schließ ' +
            'erneut ein Abo ab, um weiter zu messen.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Deine Pyxis-Daten werden am ${w.deletionOn} gelöscht`,
        preheader: () =>
          'Exportiere sie oder schließ vorher erneut ein Abo ab, um sie zu behalten.',
        heading: (w) => `Löschung am ${w.deletionOn}`,
        paragraphs: (w) => [
          `Am ${w.deletionOn} werden die Projekte deines Pyxis-Kontos mit ihren Ereignissen und ` +
            'ihren Schlüsseln endgültig gelöscht.',
          'Um die Daten zu behalten, exportiere sie auf der Kontoseite oder schließ vorher ' +
            'erneut ein Abo ab.',
        ],
      },
      withdrawn_to_free: {
        subject: () => 'Du hast den kostenpflichtigen Pyxis-Plan widerrufen',
        preheader: () => 'Dein Konto ist wieder im kostenlosen Plan.',
        heading: () => 'Zurück im kostenlosen Plan',
        paragraphs: (w) => [
          'Dein Abo wurde sofort gekündigt, und dein Konto ist wieder im kostenlosen Plan, mit seinen Projekten und Daten.',
          w.refunded === NO_REFUND
            ? 'Die automatische Erstattung der ersten Zahlung hat nicht geklappt: Wir erstatten sie innerhalb von 2 Werktagen manuell und schreiben dir.'
            : `${w.refunded} wurden auf deine Karte zurückerstattet. Der Betrag erscheint auf deiner Abrechnung, sobald dein Kartenanbieter ihn bucht.`,
          'Ab jetzt gelten wieder die Grenzen des kostenlosen Plans; die Kontoseite zeigt sie.',
        ],
      },
      back_to_free: {
        subject: () => 'Dein Pyxis-Konto ist wieder im kostenlosen Plan',
        preheader: () =>
          'Dein Abo ist beendet. Deine Websites senden weiter Ereignisse, im Rahmen des kostenlosen Plans.',
        heading: () => 'Zurück im kostenlosen Plan',
        paragraphs: (w) => [
          'Dein kostenpflichtiges Abo ist beendet, und dein Konto ist wieder im kostenlosen Plan, mit seinen Projekten, ihren Daten und ihren Schlüsseln: Deine Websites senden weiter Ereignisse an Pyxis.',
          `Der kostenlose Plan misst bis zu ${w.monthlyEvents} Ereignisse im Monat. Hat dieser Monat diese Zahl schon erreicht, pausiert die Messung bis zum 1. und läuft dann von selbst wieder an.`,
          'Um mehr zu messen, schließ auf der Kontoseite erneut ein Abo ab. Wenn du Pyxis lieber verlassen möchtest, schließ dort das Konto.',
        ],
      },
      account_deleted: {
        subject: () => 'Dein Pyxis-Konto wurde gelöscht',
        preheader: () => 'Seine Projekte, ihre Ereignisse und ihre Schlüssel gibt es nicht mehr.',
        heading: () => 'Konto gelöscht',
        paragraphs: () => [
          'Wie angekündigt wurde dein Pyxis-Konto mit seinen Projekten, ihren Ereignissen und ' +
            'ihren Schlüsseln gelöscht. Davon ist nichts mehr bei Pyxis gespeichert.',
          'Um deine Websites wieder zu messen, kannst du jederzeit ein neues Konto anlegen.',
        ],
      },
    },
    support: (address) =>
      `Wenn du Fragen hast, antworte auf diese E-Mail oder schreib an ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason: 'Du hast diese E-Mail bekommen, weil du Inhaber eines Pyxis-Kontos bist.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    notices: {
      access_ended: {
        subject: () => 'Votre abonnement à Pyxis est terminé',
        preheader: (w) =>
          `Vos sites n’envoient plus d’événements. Les données sont conservées jusqu’au ` +
          `${w.deletionOn}.`,
        heading: () => 'Abonnement terminé',
        paragraphs: (w) => [
          'L’abonnement de votre compte est terminé : ses clés ont été révoquées et vos sites ' +
            'n’envoient plus d’événements à Pyxis.',
          `Les rapports restent consultables jusqu’au ${w.deletionOn}. Ce jour-là, les projets, ` +
            'leurs événements et leurs clés seront définitivement supprimés.',
          'Pour garder les données, exportez-les depuis la page du compte d’ici là, ou ' +
            'abonnez-vous à nouveau pour continuer la mesure.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Vos données Pyxis seront supprimées le ${w.deletionOn}`,
        preheader: () => 'Exportez-les ou abonnez-vous à nouveau d’ici là pour les garder.',
        heading: (w) => `Suppression le ${w.deletionOn}`,
        paragraphs: (w) => [
          `Le ${w.deletionOn}, les projets de votre compte Pyxis, avec leurs événements et leurs ` +
            'clés, seront définitivement supprimés.',
          'Pour garder les données, exportez-les depuis la page du compte ou abonnez-vous à ' +
            'nouveau d’ici là.',
        ],
      },
      withdrawn_to_free: {
        subject: () => 'Vous vous êtes rétracté de la formule payante de Pyxis',
        preheader: () => 'Votre compte est revenu à la formule gratuite.',
        heading: () => 'De retour sur la formule gratuite',
        paragraphs: (w) => [
          'Votre abonnement a été résilié immédiatement et votre compte est revenu à la formule gratuite, avec ses projets et ses données.',
          w.refunded === NO_REFUND
            ? 'Le remboursement automatique du premier paiement n’a pas abouti\u00a0: nous le ferons à la main sous 2 jours ouvrés et vous écrirons.'
            : `${w.refunded} ont été remboursés sur votre carte. Le montant apparaît sur votre relevé dans le délai de votre banque.`,
          'Les limites de la formule gratuite s’appliquent de nouveau dès maintenant\u00a0; la page du compte les indique.',
        ],
      },
      back_to_free: {
        subject: () => 'Votre compte Pyxis est revenu à la formule gratuite',
        preheader: () =>
          'Votre abonnement est terminé. Vos sites continuent d’envoyer des événements, dans la formule gratuite.',
        heading: () => 'De retour sur la formule gratuite',
        paragraphs: (w) => [
          'Votre abonnement payant est terminé et votre compte est revenu à la formule gratuite, avec ses projets, leurs données et leurs clés\u00a0: vos sites continuent d’envoyer des événements à Pyxis.',
          `La formule gratuite mesure jusqu’à ${w.monthlyEvents} événements par mois. Si ce mois a déjà atteint ce nombre, la mesure est suspendue jusqu’au 1er, puis reprend d’elle-même.`,
          'Pour mesurer davantage, abonnez-vous à nouveau depuis la page du compte. Pour quitter Pyxis, fermez le compte depuis cette même page.',
        ],
      },
      account_deleted: {
        subject: () => 'Votre compte Pyxis a été supprimé',
        preheader: () => 'Ses projets, leurs événements et leurs clés n’existent plus.',
        heading: () => 'Compte supprimé',
        paragraphs: () => [
          'Comme annoncé, votre compte Pyxis a été supprimé avec ses projets, leurs événements ' +
            'et ' +
            'leurs clés. Il n’en reste rien dans Pyxis.',
          'Pour mesurer à nouveau vos sites, vous pouvez créer un nouveau compte à tout moment.',
        ],
      },
    },
    support: (address) => `Pour toute question, répondez à cet e-mail ou écrivez à ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason: 'Vous recevez cet e-mail parce que vous êtes propriétaire d’un compte Pyxis.',
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    notices: {
      access_ended: {
        subject: () => 'Il tuo abbonamento a Pyxis è terminato',
        preheader: (w) =>
          `I tuoi siti non inviano più eventi. I dati restano fino al giorno ${w.deletionOn}.`,
        heading: () => 'Abbonamento terminato',
        paragraphs: (w) => [
          'L’abbonamento del tuo account è terminato: le sue chiavi sono state revocate e i tuoi ' +
            'siti non inviano più eventi a Pyxis.',
          `I report restano consultabili fino al giorno ${w.deletionOn}. Quel giorno i progetti, ` +
            'i loro eventi e le loro chiavi vengono eliminati per sempre.',
          'Per conservare i dati, esportali dalla pagina dell’account prima di quella data, ' +
            'oppure ' +
            'abbonati di nuovo per continuare a misurare.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `I tuoi dati su Pyxis verranno eliminati il giorno ${w.deletionOn}`,
        preheader: () => 'Esportali o abbonati di nuovo prima di quella data per conservarli.',
        heading: (w) => `Eliminazione il giorno ${w.deletionOn}`,
        paragraphs: (w) => [
          `Il giorno ${w.deletionOn} i progetti del tuo account Pyxis, con i loro eventi e le ` +
            'loro chiavi, verranno eliminati per sempre.',
          'Per conservare i dati, esportali dalla pagina dell’account o abbonati di nuovo prima ' +
            'di quella data.',
        ],
      },
      withdrawn_to_free: {
        subject: () => 'Hai receduto dal piano a pagamento di Pyxis',
        preheader: () => 'Il tuo account è tornato al piano gratuito.',
        heading: () => 'Di nuovo nel piano gratuito',
        paragraphs: (w) => [
          'Il tuo abbonamento è stato annullato subito e il tuo account è tornato al piano gratuito, con i suoi progetti e i suoi dati.',
          w.refunded === NO_REFUND
            ? 'Il rimborso automatico del primo pagamento non è andato a buon fine: lo faremo a mano entro 2 giorni lavorativi e ti scriveremo.'
            : `${w.refunded} sono stati rimborsati sulla tua carta. L’importo compare nell’estratto conto nei tempi del circuito della carta.`,
          'Da ora valgono di nuovo i limiti del piano gratuito; la pagina dell’account li mostra.',
        ],
      },
      back_to_free: {
        subject: () => 'Il tuo account Pyxis è tornato al piano gratuito',
        preheader: () =>
          'Il tuo abbonamento è terminato. I tuoi siti continuano a inviare eventi, nel piano gratuito.',
        heading: () => 'Di nuovo nel piano gratuito',
        paragraphs: (w) => [
          'Il tuo abbonamento a pagamento è terminato e il tuo account è tornato al piano gratuito, con i suoi progetti, i loro dati e le loro chiavi: i tuoi siti continuano a inviare eventi a Pyxis.',
          `Il piano gratuito misura fino a ${w.monthlyEvents} eventi al mese. Se questo mese ha già raggiunto quel numero, la misurazione si ferma fino al giorno 1 e poi riprende da sola.`,
          'Per misurare di più, abbonati di nuovo dalla pagina dell’account. Se preferisci lasciare Pyxis, chiudi l’account da lì.',
        ],
      },
      account_deleted: {
        subject: () => 'Il tuo account Pyxis è stato eliminato',
        preheader: () => 'I suoi progetti, i loro eventi e le loro chiavi non esistono più.',
        heading: () => 'Account eliminato',
        paragraphs: () => [
          'Come annunciato, il tuo account Pyxis è stato eliminato insieme ai suoi progetti, ai ' +
            'loro eventi e alle loro chiavi. In Pyxis non ne resta nulla.',
          'Per misurare di nuovo i tuoi siti, puoi creare un nuovo account in qualsiasi momento.',
        ],
      },
    },
    support: (address) => `Per qualsiasi domanda, rispondi a questa email o scrivi a ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason: 'Hai ricevuto questa email perché possiedi un account Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    notices: {
      access_ended: {
        subject: () => 'Je Pyxis-abonnement is beëindigd',
        preheader: (w) =>
          `Je sites versturen geen events meer. De gegevens blijven bewaard tot ${w.deletionOn}.`,
        heading: () => 'Abonnement beëindigd',
        paragraphs: (w) => [
          'Het abonnement van je account is beëindigd: de sleutels zijn ingetrokken en je sites ' +
            'versturen geen events meer naar Pyxis.',
          `De rapporten blijven leesbaar tot ${w.deletionOn}. Op die dag worden de projecten, ` +
            'hun events en hun sleutels definitief verwijderd.',
          'Wil je de gegevens houden? Exporteer ze vóór die datum via de accountpagina, of neem ' +
            'opnieuw een abonnement om te blijven meten.',
        ],
      },
      deletion_reminder: {
        subject: (w) => `Je Pyxis-gegevens worden op ${w.deletionOn} verwijderd`,
        preheader: () =>
          'Exporteer ze of neem vóór die datum opnieuw een abonnement om ze te houden.',
        heading: (w) => `Verwijdering op ${w.deletionOn}`,
        paragraphs: (w) => [
          `Op ${w.deletionOn} worden de projecten van je Pyxis-account, met hun events en hun ` +
            'sleutels, definitief verwijderd.',
          'Wil je de gegevens houden? Exporteer ze via de accountpagina of neem vóór die datum ' +
            'opnieuw een abonnement.',
        ],
      },
      withdrawn_to_free: {
        subject: () => 'Je hebt het betaalde Pyxis-abonnement herroepen',
        preheader: () => 'Je account staat weer op het gratis abonnement.',
        heading: () => 'Terug op het gratis abonnement',
        paragraphs: (w) => [
          'Je abonnement is meteen opgezegd en je account staat weer op het gratis abonnement, met zijn projecten en gegevens.',
          w.refunded === NO_REFUND
            ? 'De automatische terugbetaling van de eerste betaling is niet gelukt: we doen het binnen 2 werkdagen handmatig en laten het je weten.'
            : `${w.refunded} is teruggestort op je kaart. Het bedrag verschijnt op je afschrift binnen de termijn van je kaartuitgever.`,
          'Vanaf nu gelden weer de limieten van het gratis abonnement; de accountpagina toont ze.',
        ],
      },
      back_to_free: {
        subject: () => 'Je Pyxis-account staat weer op het gratis abonnement',
        preheader: () =>
          'Je abonnement is beëindigd. Je sites blijven events sturen, binnen het gratis abonnement.',
        heading: () => 'Terug op het gratis abonnement',
        paragraphs: (w) => [
          'Je betaalde abonnement is beëindigd en je account staat weer op het gratis abonnement, met de projecten, hun gegevens en hun sleutels: je sites blijven events naar Pyxis sturen.',
          `Het gratis abonnement meet tot ${w.monthlyEvents} events per maand. Heeft deze maand dat aantal al bereikt, dan pauzeert het meten tot de 1e en gaat het daarna vanzelf weer verder.`,
          'Wil je meer meten? Neem opnieuw een abonnement via de accountpagina. Wil je Pyxis liever verlaten? Sluit dan daar het account.',
        ],
      },
      account_deleted: {
        subject: () => 'Je Pyxis-account is verwijderd',
        preheader: () => 'De projecten, hun events en hun sleutels bestaan niet meer.',
        heading: () => 'Account verwijderd',
        paragraphs: () => [
          'Zoals aangekondigd is je Pyxis-account verwijderd, samen met de projecten, hun events ' +
            'en hun sleutels. Er is in Pyxis niets meer van over.',
          'Wil je je sites weer meten? Je kunt op elk moment een nieuw account aanmaken.',
        ],
      },
    },
    support: (address) => `Heb je een vraag? Beantwoord deze e-mail of mail naar ${address}.`,
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: 'Je ontvangt deze e-mail omdat je eigenaar bent van een Pyxis-account.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
