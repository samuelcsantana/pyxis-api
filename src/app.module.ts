import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './infra/database/database.module';
import { AuthModule } from './infra/http/auth/auth.module';
import { HealthModule } from './infra/http/health/health.module';
import { IngestModule } from './infra/http/ingest/ingest.module';
import { RateLimitModule } from './infra/http/rate-limit/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    RateLimitModule,
    HealthModule,
    AuthModule,
    IngestModule,
  ],
})
export class AppModule {}
