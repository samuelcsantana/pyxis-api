import { appUrl, ownerUrl } from '../local-database';
import { withDatabase } from '../integration/test-database';

export const E2E_DATABASE = 'pyxis_e2e';

export function e2eOwnerUrl(): string {
  return withDatabase(ownerUrl(), E2E_DATABASE);
}

export function e2eAppUrl(): string {
  return withDatabase(appUrl(), E2E_DATABASE);
}
