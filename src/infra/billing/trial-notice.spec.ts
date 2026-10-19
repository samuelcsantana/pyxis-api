import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { STRIPE_CUSTOM_TEXT_MAX_LENGTH, trialNotice } from './trial-notice';

describe('trialNotice', () => {
  it('tells the customer in their language that the trial is one per customer and when it is charged', () => {
    expect(trialNotice('pt-BR', 14)).toBe(
      'Um teste grátis por cliente. Depois dos 14 dias, a cobrança é automática; cancele quando ' +
        'quiser.',
    );
    expect(trialNotice('en', 14)).toBe(
      'One free trial per customer. After the 14 days you are charged automatically; cancel any ' +
        'time.',
    );
    expect(trialNotice('es', 14)).toBe(
      'Una prueba gratis por cliente. Después de los 14 días, el cobro es automático; cancela ' +
        'cuando quieras.',
    );
    expect(trialNotice('de', 14)).toBe(
      'Eine kostenlose Testphase pro Kunde. Nach den 14 Tagen wird automatisch abgebucht; du ' +
        'kannst jederzeit kündigen.',
    );
    expect(trialNotice('fr', 14)).toBe(
      'Un seul essai gratuit par client. Au terme des 14 jours, le prélèvement est ' +
        'automatique ; résiliez à tout moment.',
    );
    expect(trialNotice('it', 14)).toBe(
      'Una prova gratuita per cliente. Dopo i 14 giorni l’addebito è automatico; puoi annullare ' +
        'quando vuoi.',
    );
    expect(trialNotice('nl', 14)).toBe(
      'Eén gratis proefperiode per klant. Na de 14 dagen wordt het bedrag automatisch ' +
        'afgeschreven; je kunt altijd opzeggen.',
    );
  });

  it.each(EMAIL_LANGUAGES)('fits the text Stripe shows above the button in %s', (language) => {
    expect(trialNotice(language, 14).length).toBeLessThanOrEqual(STRIPE_CUSTOM_TEXT_MAX_LENGTH);
  });
});
