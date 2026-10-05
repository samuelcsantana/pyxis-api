import { appUrl, ownerUrl } from '../local-database';

export const TEST_DATABASE = 'pyxis_test';

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function testOwnerUrl(): string {
  return withDatabase(ownerUrl(), TEST_DATABASE);
}

export function testAppUrl(): string {
  return withDatabase(appUrl(), TEST_DATABASE);
}
