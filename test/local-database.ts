export const LOCAL_OWNER_URL = 'postgres://pyxis:pyxis@localhost:5446/pyxis';
export const LOCAL_APP_ROLE = 'pyxis_app';
export const LOCAL_APP_URL = 'postgres://pyxis_app:pyxis_app@localhost:5446/pyxis';

export function ownerUrl(): string {
  return process.env.MIGRATION_DATABASE_URL ?? LOCAL_OWNER_URL;
}

export function appUrl(): string {
  return process.env.DATABASE_URL ?? LOCAL_APP_URL;
}

export function appRole(): string {
  return process.env.APP_DB_ROLE ?? LOCAL_APP_ROLE;
}
