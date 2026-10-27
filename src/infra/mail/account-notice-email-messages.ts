import type { AccountNoticeKind } from '../../domain/accounts/account-notice';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export const NO_REFUND = '';
export const NO_DEADLINE = '';

export interface AccountNoticeWords {
  readonly deletionOn: string;
  readonly refunded: string;
  readonly monthlyEvents: string;
  readonly fitBy: string;
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
          'To keep the data, export it from each project’s Settings before then, or subscribe again to ' +
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
          'To keep the data, export it from each project’s Settings or subscribe again before then.',
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
          w.fitBy === NO_DEADLINE
            ? 'The free plan’s limits apply again from now; the account page shows them.'
            : `Your account has more projects or people than the free plan allows. Remove what is over in each project’s Settings by ${w.fitBy}, exporting first what you want to keep; if it still does not fit on that day, the account ends: its keys are revoked, and its data is deleted 30 days later.`,
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
      empty_free_account: {
        subject: (w) => `Your free Pyxis account will be deleted on ${w.deletionOn}`,
        preheader: () => 'It has stored no events since it started on the free plan.',
        heading: () => 'No events yet',
        paragraphs: (w) => [
          'Your free Pyxis account has stored no events in the 30 days since it started on the free plan.',
          `If it still stores none, on ${w.deletionOn} the account, its projects and their keys are deleted for good, and we will email you once it is done.`,
          'To keep it, install Pyxis on your site from the Install page so that it sends events, or subscribe from the account page.',
          `To ask a person to review this deletion, reply to this email before ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Your free Pyxis account will be deleted on ${w.deletionOn}`,
        preheader: () => 'It has stored no events for 90 days.',
        heading: () => 'No events for 90 days',
        paragraphs: (w) => [
          'Your free Pyxis account has stored no events for 90 days in a row on the free plan.',
          `If it still stores none, on ${w.deletionOn} the account, its projects, their events and their keys are deleted for good, and we will email you once it is done.`,
          'To keep it, check that your site still sends events to Pyxis, or subscribe from the account page. To keep the data, export it from each project’s Settings before then.',
          `To ask a person to review this deletion, reply to this email before ${w.deletionOn}.`,
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
          'Para guardar os dados, exporte-os nas Configurações de cada projeto antes disso, ou assine de novo ' +
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
          'Para guardar os dados, exporte-os nas Configurações de cada projeto ou assine de novo antes disso.',
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
          w.fitBy === NO_DEADLINE
            ? 'Os limites do plano grátis voltam a valer a partir de agora; a página da conta mostra quais são.'
            : `Sua conta tem mais projetos ou pessoas do que o plano grátis permite. Tire o que passar do limite nas Configurações de cada projeto até ${w.fitBy}, exportando antes o que quiser guardar; se nesse dia ela ainda não couber, a conta termina: as chaves são revogadas, e os dados são apagados 30 dias depois.`,
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
      empty_free_account: {
        subject: (w) => `Sua conta grátis do Pyxis será apagada em ${w.deletionOn}`,
        preheader: () => 'Ela não guardou nenhum evento desde que entrou no plano grátis.',
        heading: () => 'Nenhum evento ainda',
        paragraphs: (w) => [
          'Sua conta grátis do Pyxis não guardou nenhum evento nos 30 dias desde que entrou no plano grátis.',
          `Se continuar sem eventos, em ${w.deletionOn} a conta, os projetos e as chaves serão apagados de vez, e avisaremos você por e-mail quando isso acontecer.`,
          'Para mantê-la, instale o Pyxis no seu site pela página Instalação, para que ele envie eventos, ou assine pela página da conta.',
          `Para pedir que uma pessoa reveja essa exclusão, responda a este e-mail antes de ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Sua conta grátis do Pyxis será apagada em ${w.deletionOn}`,
        preheader: () => 'Ela está há 90 dias sem guardar nenhum evento.',
        heading: () => '90 dias sem eventos',
        paragraphs: (w) => [
          'Sua conta grátis do Pyxis está há 90 dias seguidos sem guardar nenhum evento no plano grátis.',
          `Se continuar sem eventos, em ${w.deletionOn} a conta, os projetos, os eventos e as chaves serão apagados de vez, e avisaremos você por e-mail quando isso acontecer.`,
          'Para mantê-la, confira se o seu site ainda envia eventos ao Pyxis, ou assine pela página da conta. Para guardar os dados, exporte-os nas Configurações de cada projeto antes disso.',
          `Para pedir que uma pessoa reveja essa exclusão, responda a este e-mail antes de ${w.deletionOn}.`,
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
          'Para conservar los datos, expórtalos desde la Configuración de cada proyecto antes de esa fecha, ' +
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
          'Para conservar los datos, expórtalos desde la Configuración de cada proyecto o suscríbete de ' +
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
          w.fitBy === NO_DEADLINE
            ? 'Los límites del plan gratis vuelven a aplicarse desde ahora; la página de la cuenta los muestra.'
            : `Tu cuenta tiene más proyectos o personas de los que permite el plan gratis. Quita lo que sobra desde la Configuración de cada proyecto a más tardar el ${w.fitBy}, exportando antes lo que quieras conservar; si ese día todavía no cabe, la cuenta termina: sus claves se revocan y sus datos se eliminan 30 días después.`,
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
      empty_free_account: {
        subject: (w) => `Tu cuenta gratis de Pyxis se eliminará el ${w.deletionOn}`,
        preheader: () => 'No guardó ningún evento desde que empezó en el plan gratis.',
        heading: () => 'Todavía sin eventos',
        paragraphs: (w) => [
          'Tu cuenta gratis de Pyxis no guardó ningún evento en los 30 días desde que empezó en el plan gratis.',
          `Si sigue sin eventos, el ${w.deletionOn} la cuenta, sus proyectos y sus claves se eliminarán definitivamente, y te escribiremos cuando se haga.`,
          'Para conservarla, instala Pyxis en tu sitio desde la página Instalación para que envíe eventos, o suscríbete desde la página de la cuenta.',
          `Para pedir que una persona revise esta eliminación, responde a este correo antes del ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Tu cuenta gratis de Pyxis se eliminará el ${w.deletionOn}`,
        preheader: () => 'Lleva 90 días sin guardar ningún evento.',
        heading: () => '90 días sin eventos',
        paragraphs: (w) => [
          'Tu cuenta gratis de Pyxis lleva 90 días seguidos sin guardar ningún evento en el plan gratis.',
          `Si sigue sin eventos, el ${w.deletionOn} la cuenta, sus proyectos, sus eventos y sus claves se eliminarán definitivamente, y te escribiremos cuando se haga.`,
          'Para conservarla, comprueba que tu sitio sigue enviando eventos a Pyxis, o suscríbete desde la página de la cuenta. Para conservar los datos, expórtalos desde la Configuración de cada proyecto antes de esa fecha.',
          `Para pedir que una persona revise esta eliminación, responde a este correo antes del ${w.deletionOn}.`,
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
          'Um die Daten zu behalten, exportiere sie vorher in den Einstellungen jedes Projekts oder schließ ' +
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
          'Um die Daten zu behalten, exportiere sie in den Einstellungen jedes Projekts oder schließ vorher ' +
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
          w.fitBy === NO_DEADLINE
            ? 'Ab jetzt gelten wieder die Grenzen des kostenlosen Plans; die Kontoseite zeigt sie.'
            : `Dein Konto hat mehr Projekte oder Personen, als der kostenlose Plan erlaubt. Entferne bis zum ${w.fitBy} in den Einstellungen jedes Projekts, was zu viel ist, und exportiere vorher, was du behalten möchtest; passt das Konto an diesem Tag noch nicht, endet es: Seine Schlüssel werden widerrufen, und seine Daten werden 30 Tage später gelöscht.`,
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
      empty_free_account: {
        subject: (w) => `Dein kostenloses Pyxis-Konto wird am ${w.deletionOn} gelöscht`,
        preheader: () => 'Es hat seit dem Start im kostenlosen Plan keine Ereignisse gespeichert.',
        heading: () => 'Noch keine Ereignisse',
        paragraphs: (w) => [
          'Dein kostenloses Pyxis-Konto hat in den 30 Tagen seit dem Start im kostenlosen Plan keine Ereignisse gespeichert.',
          `Bleibt es ohne Ereignisse, werden am ${w.deletionOn} das Konto, seine Projekte und ihre Schlüssel endgültig gelöscht; wir schreiben dir, sobald es geschehen ist.`,
          'Um es zu behalten, installiere Pyxis über die Seite „Installieren“ auf deiner Website, damit sie Ereignisse sendet, oder schließ auf der Kontoseite ein Abo ab.',
          `Wenn eine Person diese Löschung prüfen soll, antworte vor dem ${w.deletionOn} auf diese E-Mail.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Dein kostenloses Pyxis-Konto wird am ${w.deletionOn} gelöscht`,
        preheader: () => 'Es hat seit 90 Tagen keine Ereignisse gespeichert.',
        heading: () => '90 Tage ohne Ereignisse',
        paragraphs: (w) => [
          'Dein kostenloses Pyxis-Konto hat 90 Tage am Stück im kostenlosen Plan keine Ereignisse gespeichert.',
          `Bleibt es ohne Ereignisse, werden am ${w.deletionOn} das Konto, seine Projekte, ihre Ereignisse und ihre Schlüssel endgültig gelöscht; wir schreiben dir, sobald es geschehen ist.`,
          'Um es zu behalten, prüfe, ob deine Website noch Ereignisse an Pyxis sendet, oder schließ auf der Kontoseite ein Abo ab. Um die Daten zu behalten, exportiere sie vorher in den Einstellungen jedes Projekts.',
          `Wenn eine Person diese Löschung prüfen soll, antworte vor dem ${w.deletionOn} auf diese E-Mail.`,
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
          'Pour garder les données, exportez-les depuis les Paramètres de chaque projet d’ici là, ou ' +
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
          'Pour garder les données, exportez-les depuis les Paramètres de chaque projet ou abonnez-vous à ' +
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
          w.fitBy === NO_DEADLINE
            ? 'Les limites de la formule gratuite s’appliquent de nouveau dès maintenant\u00a0; la page du compte les indique.'
            : `Votre compte a plus de projets ou de personnes que la formule gratuite n’en permet. Retirez ce qui dépasse depuis les Paramètres de chaque projet d’ici le ${w.fitBy}, en exportant d’abord ce que vous voulez garder\u00a0; si le compte ne rentre toujours pas ce jour-là, il prend fin\u00a0: ses clés sont révoquées et ses données sont supprimées 30 jours plus tard.`,
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
      empty_free_account: {
        subject: (w) => `Votre compte gratuit Pyxis sera supprimé le ${w.deletionOn}`,
        preheader: () =>
          'Il n’a enregistré aucun événement depuis son arrivée sur la formule gratuite.',
        heading: () => 'Aucun événement pour l’instant',
        paragraphs: (w) => [
          'Votre compte gratuit Pyxis n’a enregistré aucun événement dans les 30 jours qui ont suivi son arrivée sur la formule gratuite.',
          `S’il n’en enregistre toujours aucun, le ${w.deletionOn}, le compte, ses projets et leurs clés seront définitivement supprimés, et nous vous écrirons une fois la suppression faite.`,
          'Pour le garder, installez Pyxis sur votre site depuis la page Installation afin qu’il envoie des événements, ou abonnez-vous depuis la page du compte.',
          `Pour demander qu’une personne réexamine cette suppression, répondez à cet e-mail avant le ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Votre compte gratuit Pyxis sera supprimé le ${w.deletionOn}`,
        preheader: () => 'Il n’a enregistré aucun événement depuis 90 jours.',
        heading: () => '90 jours sans événements',
        paragraphs: (w) => [
          'Votre compte gratuit Pyxis n’a enregistré aucun événement pendant 90 jours d’affilée sur la formule gratuite.',
          `S’il n’en enregistre toujours aucun, le ${w.deletionOn}, le compte, ses projets, leurs événements et leurs clés seront définitivement supprimés, et nous vous écrirons une fois la suppression faite.`,
          'Pour le garder, vérifiez que votre site envoie toujours des événements à Pyxis, ou abonnez-vous depuis la page du compte. Pour garder les données, exportez-les depuis les Paramètres de chaque projet d’ici là.',
          `Pour demander qu’une personne réexamine cette suppression, répondez à cet e-mail avant le ${w.deletionOn}.`,
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
          'Per conservare i dati, esportali dalle Impostazioni di ogni progetto prima di quella data, ' +
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
          'Per conservare i dati, esportali dalle Impostazioni di ogni progetto o abbonati di nuovo prima ' +
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
          w.fitBy === NO_DEADLINE
            ? 'Da ora valgono di nuovo i limiti del piano gratuito; la pagina dell’account li mostra.'
            : `Il tuo account ha più progetti o persone di quanti ne consenta il piano gratuito. Togli ciò che è in più dalle Impostazioni di ogni progetto entro il giorno ${w.fitBy}, esportando prima ciò che vuoi conservare; se quel giorno non rientra ancora nei limiti, l’account termina: le sue chiavi vengono revocate e i suoi dati eliminati 30 giorni dopo.`,
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
      empty_free_account: {
        subject: (w) => `Il tuo account gratuito Pyxis verrà eliminato il giorno ${w.deletionOn}`,
        preheader: () => 'Non ha registrato nessun evento da quando è entrato nel piano gratuito.',
        heading: () => 'Ancora nessun evento',
        paragraphs: (w) => [
          'Il tuo account gratuito Pyxis non ha registrato nessun evento nei 30 giorni da quando è entrato nel piano gratuito.',
          `Se continua a non registrarne, il giorno ${w.deletionOn} l’account, i suoi progetti e le loro chiavi verranno eliminati per sempre, e ti scriveremo quando sarà fatto.`,
          'Per tenerlo, installa Pyxis sul tuo sito dalla pagina Installazione perché invii eventi, oppure abbonati dalla pagina dell’account.',
          `Per chiedere che una persona riesamini questa eliminazione, rispondi a questa email prima del giorno ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Il tuo account gratuito Pyxis verrà eliminato il giorno ${w.deletionOn}`,
        preheader: () => 'Non registra nessun evento da 90 giorni.',
        heading: () => '90 giorni senza eventi',
        paragraphs: (w) => [
          'Il tuo account gratuito Pyxis non registra nessun evento da 90 giorni di fila nel piano gratuito.',
          `Se continua a non registrarne, il giorno ${w.deletionOn} l’account, i suoi progetti, i loro eventi e le loro chiavi verranno eliminati per sempre, e ti scriveremo quando sarà fatto.`,
          'Per tenerlo, controlla che il tuo sito invii ancora eventi a Pyxis, oppure abbonati dalla pagina dell’account. Per conservare i dati, esportali dalle Impostazioni di ogni progetto prima di quella data.',
          `Per chiedere che una persona riesamini questa eliminazione, rispondi a questa email prima del giorno ${w.deletionOn}.`,
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
          'Wil je de gegevens houden? Exporteer ze vóór die datum via de Instellingen van elk project, of neem ' +
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
          'Wil je de gegevens houden? Exporteer ze via de Instellingen van elk project of neem vóór die datum ' +
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
          w.fitBy === NO_DEADLINE
            ? 'Vanaf nu gelden weer de limieten van het gratis abonnement; de accountpagina toont ze.'
            : `Je account heeft meer projecten of mensen dan het gratis abonnement toestaat. Haal uiterlijk ${w.fitBy} via de Instellingen van elk project weg wat te veel is, en exporteer eerst wat je wilt houden; past het account er op die dag nog steeds niet in, dan eindigt het: de sleutels worden ingetrokken en de gegevens 30 dagen later verwijderd.`,
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
          'Wil je meer meten? Neem opnieuw een abonnement via de accountpagina. Wil je Pyxis liever verlaten? Hef dan daar het account op.',
        ],
      },
      empty_free_account: {
        subject: (w) => `Je gratis Pyxis-account wordt op ${w.deletionOn} verwijderd`,
        preheader: () =>
          'Het heeft nog geen enkel event opgeslagen sinds het op het gratis abonnement begon.',
        heading: () => 'Nog geen events',
        paragraphs: (w) => [
          'Je gratis Pyxis-account heeft in de 30 dagen sinds het op het gratis abonnement begon geen enkel event opgeslagen.',
          `Blijft het zonder events, dan worden op ${w.deletionOn} het account, de projecten en hun sleutels definitief verwijderd; we mailen je zodra dat is gebeurd.`,
          'Wil je het houden? Installeer Pyxis op je site via de pagina Installeren, zodat die events stuurt, of neem een abonnement via de accountpagina.',
          `Wil je dat een persoon deze verwijdering bekijkt? Beantwoord deze e-mail vóór ${w.deletionOn}.`,
        ],
      },
      idle_free_account: {
        subject: (w) => `Je gratis Pyxis-account wordt op ${w.deletionOn} verwijderd`,
        preheader: () => 'Het heeft al 90 dagen geen enkel event opgeslagen.',
        heading: () => '90 dagen zonder events',
        paragraphs: (w) => [
          'Je gratis Pyxis-account heeft 90 dagen achter elkaar op het gratis abonnement geen enkel event opgeslagen.',
          `Blijft het zonder events, dan worden op ${w.deletionOn} het account, de projecten, hun events en hun sleutels definitief verwijderd; we mailen je zodra dat is gebeurd.`,
          'Wil je het houden? Controleer of je site nog events naar Pyxis stuurt, of neem een abonnement via de accountpagina. Wil je de gegevens houden? Exporteer ze vóór die datum via de Instellingen van elk project.',
          `Wil je dat een persoon deze verwijdering bekijkt? Beantwoord deze e-mail vóór ${w.deletionOn}.`,
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
