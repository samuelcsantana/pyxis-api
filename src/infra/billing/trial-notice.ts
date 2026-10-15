import type { EmailLanguage } from '../../domain/auth/email-language';

export const STRIPE_CUSTOM_TEXT_MAX_LENGTH = 1200;

const TRIAL_NOTICES: Readonly<Record<EmailLanguage, (days: number) => string>> = {
  en: (days) =>
    `One free trial per customer. After the ${String(days)} days you are charged ` +
    'automatically; cancel any time.',
  'pt-BR': (days) =>
    `Um teste grátis por cliente. Depois dos ${String(days)} dias, a cobrança é ` +
    'automática; cancele quando quiser.',
  es: (days) =>
    `Una prueba gratis por cliente. Después de los ${String(days)} días, el cobro es ` +
    'automático; cancela cuando quieras.',
};

export function trialNotice(language: EmailLanguage, trialDays: number): string {
  return TRIAL_NOTICES[language](trialDays);
}
