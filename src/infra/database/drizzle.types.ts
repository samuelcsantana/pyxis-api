import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';

export type PostgresClient = Sql;
export type DrizzleDatabase = PostgresJsDatabase;
