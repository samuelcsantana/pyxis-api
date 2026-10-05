import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { POSTGRES_CLIENT } from './drizzle.constants';
import type { DrizzleDatabase, PostgresClient } from './drizzle.types';
import { postgresClientOptions } from './postgres-options';

export const MISSING_DATABASE_URL_MESSAGE =
  'DATABASE_URL is required to start the API: set it to the application role connection string.';

export function createPostgresClient(databaseUrl: string | undefined): PostgresClient {
  if (databaseUrl === undefined) {
    throw new Error(MISSING_DATABASE_URL_MESSAGE);
  }
  return postgres(databaseUrl, postgresClientOptions());
}

export function createDrizzleDatabase(client: PostgresClient): DrizzleDatabase {
  return drizzle(client);
}

@Injectable()
export class PostgresClientLifecycle implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: PostgresClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}
