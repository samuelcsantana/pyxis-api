import type { AcceptedTerms } from '../../domain/accounts/welcome';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface FreePlanText {
  readonly events: string;
  readonly projects: number;
  readonly people: number;
  readonly pauseAt: string;
}

function counted(count: number, one: string, other: string): string {
  return `${String(count)} ${count === 1 ? one : other}`;
}

export interface WelcomeEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: string;
  readonly heading: string;
  readonly trialPreheader: (trialEndsOn: string) => string;
  readonly activePreheader: string;
  readonly trialConfirmed: (trialEndsOn: string) => string;
  readonly activeConfirmed: string;
  readonly freePreheader: string;
  readonly freeConfirmed: (plan: FreePlanText) => string;
  readonly freeReason: string;
  readonly freeInactivity: string;
  readonly nextStep: string;
  readonly terms: (terms: AcceptedTerms) => string;
  readonly openDashboard: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const WELCOME_EMAIL_MESSAGES: Readonly<Record<EmailLanguage, WelcomeEmailMessages>> = {
  en: {
    language: 'en',
    subject: 'Welcome to Pyxis',
    heading: 'Welcome to Pyxis',
    trialPreheader: (day) => `Your free trial runs until ${day}.`,
    activePreheader: 'Your subscription is active.',
    trialConfirmed: (day) =>
      `Your subscription is confirmed. The free trial runs until ${day}; Stripe charges the ` +
      'first payment then, and you can cancel before it in the billing portal.',
    activeConfirmed:
      'Your subscription is confirmed and active. You can change or cancel it at any time in the ' +
      'billing portal.',
    nextStep:
      'Next, create your first project in the dashboard: give it your site’s address and add the ' +
      'snippet with its key to your pages. The first visit shows up within seconds.',
    terms: (terms) =>
      'You accepted the Terms of Use, the Data Processing Agreement and the Privacy Policy, ' +
      `version ${terms.version}, written in Brazilian Portuguese: ${terms.url}`,
    freePreheader: 'Your account is on the free plan.',
    freeConfirmed: (plan) =>
      `Your account is on the free plan, with no card: up to ${plan.events} events a month, ` +
      `${counted(plan.projects, 'project', 'projects')} and ` +
      `${counted(plan.people, 'person', 'people')}, with every feature. Measuring pauses when ` +
      `the month reaches ${plan.pauseAt} events and comes back on the 1st. You can subscribe ` +
      'to the paid plan at any time, in Account and billing.',
    freeInactivity:
      'A free account that stores no events in its first 30 days, or none for 90 days in a row, is deleted seven days after an email notice; a paid account never is.',
    freeReason: 'You received this email because you created a Pyxis account.',
    openDashboard: 'Open the dashboard',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason: 'You received this email because you subscribed to Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: 'Boas-vindas ao Pyxis',
    heading: 'Boas-vindas ao Pyxis',
    trialPreheader: (day) => `Seu teste grátis vai até ${day}.`,
    activePreheader: 'Sua assinatura está ativa.',
    trialConfirmed: (day) =>
      `Sua assinatura está confirmada. O teste grátis vai até ${day}; o Stripe cobra o primeiro ` +
      'pagamento nesse dia, e você pode cancelar antes disso no portal de cobrança.',
    activeConfirmed:
      'Sua assinatura está confirmada e ativa. Você pode mudá-la ou cancelá-la quando quiser no ' +
      'portal de cobrança.',
    nextStep:
      'Agora, crie seu primeiro projeto no painel: informe o endereço do seu site e coloque o ' +
      'trecho com a chave nas suas páginas. A primeira visita aparece em segundos.',
    terms: (terms) =>
      'Você aceitou os Termos de Uso, o Acordo de Tratamento de Dados e a Política de ' +
      `Privacidade, versão ${terms.version}: ${terms.url}`,
    freePreheader: 'Sua conta está no plano grátis.',
    freeConfirmed: (plan) =>
      `Sua conta está no plano grátis, sem cartão: até ${plan.events} eventos por mês, ` +
      `${counted(plan.projects, 'projeto', 'projetos')} e ` +
      `${counted(plan.people, 'pessoa', 'pessoas')}, com todas as funções. A medição pausa ` +
      `quando o mês chega a ${plan.pauseAt} eventos e volta no dia 1º. Você pode assinar o ` +
      'plano pago quando quiser, em Conta e cobrança.',
    freeInactivity:
      'Uma conta grátis que não guardar nenhum evento nos primeiros 30 dias, ou ficar 90 dias seguidos sem eventos, é apagada sete dias depois de um aviso por e-mail; uma conta paga nunca é.',
    freeReason: 'Você recebeu este e-mail porque criou uma conta no Pyxis.',
    openDashboard: 'Abrir o painel',
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason: 'Você recebeu este e-mail porque assinou o Pyxis.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    subject: 'Te damos la bienvenida a Pyxis',
    heading: 'Te damos la bienvenida a Pyxis',
    trialPreheader: (day) => `Tu prueba gratuita dura hasta el ${day}.`,
    activePreheader: 'Tu suscripción está activa.',
    trialConfirmed: (day) =>
      `Tu suscripción está confirmada. La prueba gratuita dura hasta el ${day}; Stripe cobra el ` +
      'primer pago ese día, y puedes cancelar antes en el portal de facturación.',
    activeConfirmed:
      'Tu suscripción está confirmada y activa. Puedes cambiarla o cancelarla cuando quieras en ' +
      'el portal de facturación.',
    nextStep:
      'Ahora, crea tu primer proyecto en el panel: indica la dirección de tu sitio y agrega el ' +
      'fragmento con su clave a tus páginas. La primera visita aparece en segundos.',
    terms: (terms) =>
      'Aceptaste los Términos de Uso, el Acuerdo de Tratamiento de Datos y la Política de ' +
      `Privacidad, versión ${terms.version}, redactados en portugués de Brasil: ${terms.url}`,
    freePreheader: 'Tu cuenta está en el plan gratis.',
    freeConfirmed: (plan) =>
      `Tu cuenta está en el plan gratis, sin tarjeta: hasta ${plan.events} eventos al mes, ` +
      `${counted(plan.projects, 'proyecto', 'proyectos')} y ` +
      `${counted(plan.people, 'persona', 'personas')}, con todas las funciones. La medición se ` +
      `pausa cuando el mes llega a ${plan.pauseAt} eventos y vuelve el día 1. Puedes ` +
      'suscribirte al plan de pago cuando quieras, en Cuenta y facturación.',
    freeInactivity:
      'Una cuenta gratis que no guarde ningún evento en sus primeros 30 días, o pase 90 días seguidos sin eventos, se elimina siete días después de un aviso por correo; una cuenta de pago, nunca.',
    freeReason: 'Recibiste este correo porque creaste una cuenta en Pyxis.',
    openDashboard: 'Abrir el panel',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: 'Recibiste este correo porque te suscribiste a Pyxis.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    subject: 'Willkommen bei Pyxis',
    heading: 'Willkommen bei Pyxis',
    trialPreheader: (day) => `Deine kostenlose Testphase läuft bis zum ${day}.`,
    activePreheader: 'Dein Abo ist aktiv.',
    trialConfirmed: (day) =>
      `Dein Abo ist bestätigt. Die kostenlose Testphase läuft bis zum ${day}; dann bucht Stripe ` +
      `die ` +
      'erste Zahlung ab, und du kannst vorher im Abrechnungsportal kündigen.',
    activeConfirmed:
      'Dein Abo ist bestätigt und aktiv. Du kannst es jederzeit im Abrechnungsportal ändern ' +
      'oder kündigen.',
    nextStep:
      'Lege als Nächstes dein erstes Projekt im Dashboard an: Gib die Adresse deiner Website an ' +
      'und füge das Snippet mit seinem Schlüssel in deine Seiten ein. Der erste Besuch erscheint ' +
      'innerhalb von Sekunden.',
    terms: (terms) =>
      'Du hast die Nutzungsbedingungen, den Auftragsverarbeitungsvertrag und die ' +
      `Datenschutzerklärung in Version ${terms.version} akzeptiert, verfasst auf brasilianischem ` +
      `Portugiesisch: ${terms.url}`,
    freePreheader: 'Dein Konto ist im kostenlosen Plan.',
    freeConfirmed: (plan) =>
      `Dein Konto ist im kostenlosen Plan, ohne Karte: bis zu ${plan.events} Ereignisse im ` +
      `Monat, ${counted(plan.projects, 'Projekt', 'Projekte')} und ` +
      `${counted(plan.people, 'Person', 'Personen')}, mit allen Funktionen. Die Messung ` +
      `pausiert, wenn der Monat ${plan.pauseAt} Ereignisse erreicht, und läuft am 1. wieder ` +
      'an. Du kannst den kostenpflichtigen Plan jederzeit unter Konto und Abrechnung abonnieren.',
    freeInactivity:
      'Ein kostenloses Konto, das in den ersten 30 Tagen keine Ereignisse speichert oder 90 Tage am Stück ohne Ereignisse bleibt, wird sieben Tage nach einer Benachrichtigung per E-Mail gelöscht; ein kostenpflichtiges Konto nie.',
    freeReason: 'Du hast diese E-Mail bekommen, weil du ein Pyxis-Konto erstellt hast.',
    openDashboard: 'Dashboard öffnen',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason: 'Du hast diese E-Mail bekommen, weil du Pyxis abonniert hast.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    subject: 'Bienvenue dans Pyxis',
    heading: 'Bienvenue dans Pyxis',
    trialPreheader: (day) => `Votre essai gratuit dure jusqu’au ${day}.`,
    activePreheader: 'Votre abonnement est actif.',
    trialConfirmed: (day) =>
      `Votre abonnement est confirmé. L’essai gratuit dure jusqu’au ${day}\u202f; Stripe prélève ` +
      'alors le premier paiement, et vous pouvez résilier avant dans le portail de facturation.',
    activeConfirmed:
      'Votre abonnement est confirmé et actif. Vous pouvez le modifier ou le résilier à tout ' +
      'moment dans le portail de facturation.',
    nextStep:
      'Ensuite, créez votre premier projet dans le tableau de bord : indiquez l’adresse de ' +
      'votre site et ajoutez à vos pages l’extrait de code avec sa clé. La première visite ' +
      'apparaît en quelques secondes.',
    terms: (terms) =>
      'Vous avez accepté les Conditions d’utilisation, l’Accord de traitement des données et la ' +
      `Politique de confidentialité, version ${terms.version}, rédigés en portugais du ` +
      `Brésil\u00a0: ` +
      terms.url,
    freePreheader: 'Votre compte est sur la formule gratuite.',
    freeConfirmed: (plan) =>
      `Votre compte est sur la formule gratuite, sans carte\u00a0: jusqu’à ${plan.events} ` +
      `événements par mois, ${counted(plan.projects, 'projet', 'projets')} et ` +
      `${counted(plan.people, 'personne', 'personnes')}, avec toutes les fonctions. La mesure ` +
      `se met en pause quand le mois atteint ${plan.pauseAt} événements et reprend le 1er. ` +
      'Vous pouvez vous abonner à la formule payante à tout moment, dans Compte et facturation.',
    freeInactivity:
      'Un compte gratuit qui n’enregistre aucun événement pendant ses 30 premiers jours, ou aucun pendant 90 jours d’affilée, est supprimé sept jours après un avis par e-mail\u00a0; un compte payant ne l’est jamais.',
    freeReason: 'Vous recevez cet e-mail parce que vous avez créé un compte Pyxis.',
    openDashboard: 'Ouvrir le tableau de bord',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason: 'Vous recevez cet e-mail parce que vous vous êtes abonné à Pyxis.',
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    subject: 'Ti diamo il benvenuto in Pyxis',
    heading: 'Ti diamo il benvenuto in Pyxis',
    trialPreheader: (day) => `La tua prova gratuita dura fino al giorno ${day}.`,
    activePreheader: 'Il tuo abbonamento è attivo.',
    trialConfirmed: (day) =>
      `Il tuo abbonamento è confermato. La prova gratuita dura fino al giorno ${day}; quel ` +
      `giorno ` +
      'Stripe addebita il primo pagamento, e puoi annullare prima nel portale di fatturazione.',
    activeConfirmed:
      'Il tuo abbonamento è confermato e attivo. Puoi modificarlo o annullarlo in qualsiasi ' +
      'momento nel portale di fatturazione.',
    nextStep:
      'Ora crea il tuo primo progetto nella dashboard: indica l’indirizzo del tuo sito e ' +
      'aggiungi ' +
      'alle tue pagine lo snippet con la sua chiave. La prima visita compare in pochi secondi.',
    terms: (terms) =>
      'Hai accettato i Termini di utilizzo, l’Accordo sul trattamento dei dati e l’Informativa ' +
      `sulla privacy, versione ${terms.version}, redatti in portoghese brasiliano: ${terms.url}`,
    freePreheader: 'Il tuo account è nel piano gratuito.',
    freeConfirmed: (plan) =>
      `Il tuo account è nel piano gratuito, senza carta: fino a ${plan.events} eventi al mese, ` +
      `${counted(plan.projects, 'progetto', 'progetti')} e ` +
      `${counted(plan.people, 'persona', 'persone')}, con tutte le funzioni. La misurazione va ` +
      `in pausa quando il mese arriva a ${plan.pauseAt} eventi e riprende il giorno 1. Puoi ` +
      'abbonarti al piano a pagamento quando vuoi, in Account e fatturazione.',
    freeInactivity:
      'Un account gratuito che non registra nessun evento nei primi 30 giorni, o nessuno per 90 giorni di fila, viene eliminato sette giorni dopo un avviso via email; un account a pagamento mai.',
    freeReason: 'Hai ricevuto questa email perché hai creato un account Pyxis.',
    openDashboard: 'Apri la dashboard',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason: 'Hai ricevuto questa email perché hai sottoscritto un abbonamento a Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    subject: 'Welkom bij Pyxis',
    heading: 'Welkom bij Pyxis',
    trialPreheader: (day) => `Je gratis proefperiode loopt tot ${day}.`,
    activePreheader: 'Je abonnement is actief.',
    trialConfirmed: (day) =>
      `Je abonnement is bevestigd. De gratis proefperiode loopt tot ${day}; dan schrijft Stripe ` +
      'de eerste betaling af, en je kunt vóór die dag opzeggen in het facturatieportaal.',
    activeConfirmed:
      'Je abonnement is bevestigd en actief. Je kunt het op elk moment wijzigen of opzeggen in ' +
      'het facturatieportaal.',
    nextStep:
      'Maak nu je eerste project aan in het dashboard: geef het adres van je site op en zet het ' +
      'fragment met de sleutel in je pagina’s. Het eerste bezoek verschijnt binnen enkele ' +
      'seconden.',
    terms: (terms) =>
      'Je bent akkoord gegaan met de Gebruiksvoorwaarden, de Verwerkersovereenkomst en het ' +
      `Privacybeleid, versie ${terms.version}, opgesteld in het Braziliaans-Portugees: ` +
      terms.url,
    freePreheader: 'Je account staat op het gratis abonnement.',
    freeConfirmed: (plan) =>
      `Je account staat op het gratis abonnement, zonder kaart: maximaal ${plan.events} events ` +
      `per maand, ${counted(plan.projects, 'project', 'projecten')} en ` +
      `${counted(plan.people, 'persoon', 'personen')}, met alle functies. Het meten pauzeert ` +
      `wanneer de maand ${plan.pauseAt} events bereikt en gaat op de 1e weer verder. Je kunt ` +
      'op elk moment het betaalde abonnement nemen, onder Account en facturatie.',
    freeInactivity:
      'Een gratis account dat in de eerste 30 dagen geen enkel event opslaat, of 90 dagen achter elkaar geen, wordt zeven dagen na een melding per e-mail verwijderd; een betaald account nooit.',
    freeReason: 'Je ontvangt deze e-mail omdat je een Pyxis-account hebt aangemaakt.',
    openDashboard: 'Dashboard openen',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: 'Je ontvangt deze e-mail omdat je je hebt geabonneerd op Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
