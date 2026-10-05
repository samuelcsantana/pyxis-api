import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';
import { DatabaseRoleCheck } from './database-role.check';
import { DRIZZLE_CLIENT, POSTGRES_CLIENT } from './drizzle.constants';
import type { PostgresClient } from './drizzle.types';
import {
  createDrizzleDatabase,
  createPostgresClient,
  PostgresClientLifecycle,
} from './postgres-client';

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        createPostgresClient(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DRIZZLE_CLIENT,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: PostgresClient) => createDrizzleDatabase(client),
    },
    PostgresClientLifecycle,
    DatabaseRoleCheck,
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DatabaseModule {}
