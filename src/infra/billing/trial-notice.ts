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
  de: (days) =>
    `Eine kostenlose Testphase pro Kunde. Nach den ${String(days)} Tagen wird automatisch ` +
    'abgebucht; du kannst jederzeit kündigen.',
  fr: (days) =>
    `Un seul essai gratuit par client. Au terme des ${String(days)} jours, le prélèvement est ` +
    'automatique ; résiliez à tout moment.',
  it: (days) =>
    `Una prova gratuita per cliente. Dopo i ${String(days)} giorni l’addebito è ` +
    'automatico; puoi annullare quando vuoi.',
  nl: (days) =>
    `Eén gratis proefperiode per klant. Na de ${String(days)} dagen wordt het bedrag ` +
    'automatisch afgeschreven; je kunt altijd opzeggen.',
};

export function trialNotice(language: EmailLanguage, trialDays: number): string {
  return TRIAL_NOTICES[language](trialDays);
}
