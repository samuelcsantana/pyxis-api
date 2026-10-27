import type { SubscriptionConfirmation } from '../../domain/accounts/subscription-confirmation';
import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildSubscriptionConfirmedEmail } from './subscription-confirmed-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const MONTHLY: SubscriptionConfirmation = {
  interval: 'month',
  withdrawalDays: 7,
  terms: { version: '1.3', url: 'https://example.com/termos' },
};
const UNKNOWN_INTERVAL: SubscriptionConfirmation = {
  interval: null,
  withdrawalDays: 7,
  terms: null,
};

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

describe('buildSubscriptionConfirmedEmail', () => {
  it('confirms the paid plan, its interval, the withdrawal right and the terms accepted', () => {
    const email = buildSubscriptionConfirmedEmail(MONTHLY, 'en', LINKS);

    expect(email.subject).toBe('Your Pyxis subscription is confirmed');
    expect(email.html).toContain('Your account is now on the paid plan, billed monthly.');
    expect(email.html).toContain('it resumes within a minute');
    expect(email.html).toContain('You can withdraw within 7 days of this first payment');
    expect(email.html).toContain('the account goes back to the free plan');
    expect(email.html).toContain('version 1.3, written in Brazilian Portuguese');
    expect(email.text).toContain('https://example.com/termos');
    expect(email.text).toContain('because you subscribed to Pyxis');
  });

  it('confirms in the reader’s language, and leaves out an interval and terms it does not have', () => {
    const email = buildSubscriptionConfirmedEmail(UNKNOWN_INTERVAL, 'pt-BR', LINKS);

    expect(email.subject).toBe('Sua assinatura do Pyxis está confirmada');
    expect(email.html).toContain('Sua conta agora está no plano pago. Se a medição');
    expect(email.html).not.toContain('com cobrança');
    expect(email.text).not.toContain('Termos de Uso');
  });

  it('names the yearly interval', () => {
    expect(
      buildSubscriptionConfirmedEmail({ ...MONTHLY, interval: 'year' }, 'es', LINKS).html,
    ).toContain('con cobro anual');
  });

  it('declares its language and keeps every plain-text line short', () => {
    for (const language of EMAIL_LANGUAGES) {
      for (const confirmation of [MONTHLY, UNKNOWN_INTERVAL]) {
        const email = buildSubscriptionConfirmedEmail(confirmation, language, LINKS);
        expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
        expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
      }
    }
  });
});
