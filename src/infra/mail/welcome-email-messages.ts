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
};
