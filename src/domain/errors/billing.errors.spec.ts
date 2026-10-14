import { BillingUnavailableError, InvalidBillingSignatureError } from './billing.errors';
import { DomainError } from './domain.error';

describe('billing errors', () => {
  it.each([
    [new BillingUnavailableError('prices.list failed'), 'billing_unavailable'],
    [new InvalidBillingSignatureError(), 'invalid_billing_signature'],
  ])('%s carries a stable machine code', (error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.message).not.toBe('');
  });

  it('keeps the reason for the logs out of the message a caller sees', () => {
    const error = new BillingUnavailableError('checkout.sessions.create failed');

    expect(error.reason).toBe('checkout.sessions.create failed');
    expect(error.message).not.toContain('checkout');
  });
});
