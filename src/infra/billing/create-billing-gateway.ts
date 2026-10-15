import Stripe from 'stripe';
import type {
  BillingEvent,
  BillingGateway,
  BillingSubscription,
  PaidInvoice,
} from '../../domain/billing/billing-gateway';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { StripeBillingGateway } from './stripe-billing-gateway';

const SECRET_KEY_SHAPE = /^(sk|rk)_(live|test)_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_SHAPE = /^whsec_[A-Za-z0-9]+$/;
const STRIPE_NETWORK_RETRIES = 2;
const NOT_CONFIGURED = 'STRIPE_SECRET_KEY is not set to a Stripe secret or restricted key';

export interface BillingSettings {
  readonly STRIPE_SECRET_KEY?: string | undefined;
  readonly STRIPE_WEBHOOK_SECRET?: string | undefined;
}

export class UnconfiguredBillingGateway implements BillingGateway {
  createCheckout(): Promise<{ readonly url: string }> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  createPortal(): Promise<{ readonly url: string }> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  subscription(): Promise<BillingSubscription> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  cancelSubscription(): Promise<void> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  refundFirstPaymentSince(): Promise<number> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  latestPaidInvoice(): Promise<PaidInvoice | null> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  refundInvoice(): Promise<number> {
    return Promise.reject(new BillingUnavailableError(NOT_CONFIGURED));
  }

  parseEvent(): BillingEvent {
    throw new BillingUnavailableError(NOT_CONFIGURED);
  }
}

export function createBillingGateway(settings: BillingSettings): BillingGateway {
  const secretKey = settings.STRIPE_SECRET_KEY;
  if (secretKey === undefined || !SECRET_KEY_SHAPE.test(secretKey)) {
    return new UnconfiguredBillingGateway();
  }
  const webhookSecret = settings.STRIPE_WEBHOOK_SECRET;
  return new StripeBillingGateway(
    new Stripe(secretKey, { maxNetworkRetries: STRIPE_NETWORK_RETRIES }),
    webhookSecret !== undefined && WEBHOOK_SECRET_SHAPE.test(webhookSecret) ? webhookSecret : null,
  );
}
