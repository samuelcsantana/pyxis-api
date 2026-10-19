import type { AcceptedTerms } from '../../domain/accounts/welcome';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface WelcomeEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: string;
  readonly heading: string;
  readonly trialPreheader: (trialEndsOn: string) => string;
  readonly activePreheader: string;
  readonly trialConfirmed: (trialEndsOn: string) => string;
  readonly activeConfirmed: string;
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
    openDashboard: 'Dashboard openen',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: 'Je ontvangt deze e-mail omdat je je hebt geabonneerd op Pyxis.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
