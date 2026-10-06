import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateServerEnv } from './config/env.schema';
import { DatabaseModule } from './infra/database/database.module';
import { AuthModule } from './infra/http/auth/auth.module';
import { HealthModule } from './infra/http/health/health.module';
import { IngestModule } from './infra/http/ingest/ingest.module';
import { RateLimitModule } from './infra/http/rate-limit/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateServerEnv }),
    DatabaseModule,
    RateLimitModule,
    HealthModule,
    AuthModule,
    IngestModule,
  ],
})
export class AppModule {}
