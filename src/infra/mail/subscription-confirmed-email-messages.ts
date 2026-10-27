import type { EmailLanguage } from '../../domain/auth/email-language';
import type { BillingInterval } from '../../domain/billing/billing-gateway';

export interface SubscriptionConfirmedEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: string;
  readonly heading: string;
  readonly preheader: string;
  readonly intervals: Readonly<Record<BillingInterval, string>>;
  readonly confirmed: (interval: string | null) => string;
  readonly withdrawal: (days: number) => string;
  readonly manage: string;
}

export const SUBSCRIPTION_CONFIRMED_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, SubscriptionConfirmedEmailMessages>
> = {
  en: {
    language: 'en',
    subject: 'Your Pyxis subscription is confirmed',
    heading: 'Subscription confirmed',
    preheader: 'Your account is on the paid plan.',
    intervals: { month: 'monthly', year: 'yearly' },
    confirmed: (interval) =>
      (interval === null
        ? 'Your account is now on the paid plan.'
        : `Your account is now on the paid plan, billed ${interval}.`) +
      ' If measuring was paused, it resumes within a minute.',
    withdrawal: (days) =>
      `You can withdraw within ${String(days)} days of this first payment and get it back in ` +
      'full: reply to this email, and the account goes back to the free plan.',
    manage: 'You can change or cancel the subscription at any time in the billing portal.',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: 'Sua assinatura do Pyxis está confirmada',
    heading: 'Assinatura confirmada',
    preheader: 'Sua conta está no plano pago.',
    intervals: { month: 'mensal', year: 'anual' },
    confirmed: (interval) =>
      (interval === null
        ? 'Sua conta agora está no plano pago.'
        : `Sua conta agora está no plano pago, com cobrança ${interval}.`) +
      ' Se a medição estava pausada, ela volta em até um minuto.',
    withdrawal: (days) =>
      `Você pode desistir em até ${String(days)} dias deste primeiro pagamento e receber o valor ` +
      'de volta por inteiro: responda a este e-mail, e a conta volta ao plano grátis.',
    manage: 'Você pode mudar ou cancelar a assinatura quando quiser, no portal de cobrança.',
  },
  es: {
    language: 'es',
    subject: 'Tu suscripción a Pyxis está confirmada',
    heading: 'Suscripción confirmada',
    preheader: 'Tu cuenta está en el plan de pago.',
    intervals: { month: 'mensual', year: 'anual' },
    confirmed: (interval) =>
      (interval === null
        ? 'Tu cuenta ahora está en el plan de pago.'
        : `Tu cuenta ahora está en el plan de pago, con cobro ${interval}.`) +
      ' Si la medición estaba en pausa, vuelve en menos de un minuto.',
    withdrawal: (days) =>
      `Puedes desistir en los ${String(days)} días siguientes a este primer pago y recuperarlo ` +
      'por completo: responde a este correo, y la cuenta vuelve al plan gratis.',
    manage: 'Puedes cambiar o cancelar la suscripción cuando quieras en el portal de facturación.',
  },
  de: {
    language: 'de',
    subject: 'Dein Pyxis-Abo ist bestätigt',
    heading: 'Abo bestätigt',
    preheader: 'Dein Konto ist im kostenpflichtigen Plan.',
    intervals: { month: 'monatlicher', year: 'jährlicher' },
    confirmed: (interval) =>
      (interval === null
        ? 'Dein Konto ist jetzt im kostenpflichtigen Plan.'
        : `Dein Konto ist jetzt im kostenpflichtigen Plan, mit ${interval} Abrechnung.`) +
      ' Falls die Messung pausiert war, läuft sie innerhalb einer Minute wieder an.',
    withdrawal: (days) =>
      `Du kannst innerhalb von ${String(days)} Tagen nach dieser ersten Zahlung widerrufen und ` +
      'bekommst sie vollständig zurück: Antworte auf diese E-Mail, und das Konto kehrt zum ' +
      'kostenlosen Plan zurück.',
    manage: 'Du kannst das Abo jederzeit im Abrechnungsportal ändern oder kündigen.',
  },
  fr: {
    language: 'fr',
    subject: 'Votre abonnement Pyxis est confirmé',
    heading: 'Abonnement confirmé',
    preheader: 'Votre compte est sur la formule payante.',
    intervals: { month: 'mensuellement', year: 'annuellement' },
    confirmed: (interval) =>
      (interval === null
        ? 'Votre compte est désormais sur la formule payante.'
        : `Votre compte est désormais sur la formule payante, facturée ${interval}.`) +
      ' Si la mesure était en pause, elle reprend en moins d’une minute.',
    withdrawal: (days) =>
      `Vous pouvez vous rétracter dans les ${String(days)} jours suivant ce premier paiement et ` +
      'être remboursé intégralement\u00a0: répondez à cet e-mail, et le compte revient à la ' +
      'formule gratuite.',
    manage:
      'Vous pouvez modifier ou résilier l’abonnement à tout moment dans le portail de facturation.',
  },
  it: {
    language: 'it',
    subject: 'Il tuo abbonamento a Pyxis è confermato',
    heading: 'Abbonamento confermato',
    preheader: 'Il tuo account è nel piano a pagamento.',
    intervals: { month: 'mensile', year: 'annuale' },
    confirmed: (interval) =>
      (interval === null
        ? 'Il tuo account ora è nel piano a pagamento.'
        : `Il tuo account ora è nel piano a pagamento, con addebito ${interval}.`) +
      ' Se la misurazione era in pausa, riprende entro un minuto.',
    withdrawal: (days) =>
      `Puoi recedere entro ${String(days)} giorni da questo primo pagamento e riaverlo per ` +
      'intero: rispondi a questa email, e l’account torna al piano gratuito.',
    manage:
      'Puoi modificare o annullare l’abbonamento in qualsiasi momento nel portale di fatturazione.',
  },
  nl: {
    language: 'nl',
    subject: 'Je Pyxis-abonnement is bevestigd',
    heading: 'Abonnement bevestigd',
    preheader: 'Je account staat op het betaalde abonnement.',
    intervals: { month: 'maandelijks', year: 'jaarlijks' },
    confirmed: (interval) =>
      (interval === null
        ? 'Je account staat nu op het betaalde abonnement.'
        : `Je account staat nu op het betaalde abonnement, ${interval} gefactureerd.`) +
      ' Als het meten gepauzeerd was, gaat het binnen een minuut weer verder.',
    withdrawal: (days) =>
      `Je kunt binnen ${String(days)} dagen na deze eerste betaling herroepen en krijgt het ` +
      'bedrag volledig terug: beantwoord deze e-mail, en het account gaat terug naar het gratis ' +
      'abonnement.',
    manage: 'Je kunt het abonnement op elk moment wijzigen of opzeggen in het facturatieportaal.',
  },
};
