import { PlanRequiredError } from '../errors/account.errors';
import { type AccountStatus, isOnProPlan } from './account-status';

export const PRO_FEATURES = [
  'public_share_link',
  'slack_alerts',
  'annotations_by_token',
  'ga4_import',
  'search_console',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export interface ProFeatureAccount {
  readonly status: AccountStatus;
}

export function mayUseProFeatures(account: ProFeatureAccount | null): boolean {
  return account === null || isOnProPlan(account.status);
}

export function requireProFeature(account: ProFeatureAccount | null, feature: ProFeature): void {
  if (!mayUseProFeatures(account)) {
    throw new PlanRequiredError(feature);
  }
}
