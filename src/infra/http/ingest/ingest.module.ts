import { Module } from '@nestjs/common';
import { EVENT_REPOSITORY } from '../../../domain/repositories/event.repository';
import { PROJECT_REPOSITORY } from '../../../domain/repositories/project.repository';
import { CLOCK, type Clock } from '../../../domain/services/clock';
import { PROJECT_RATE_LIMITER } from '../../../domain/services/project-rate-limiter';
import { IngestBatchUseCase } from '../../../usecases/ingest/ingest-batch.usecase';
import { SystemClock } from '../../clock/system-clock';
import { DRIZZLE_CLIENT } from '../../database/drizzle.constants';
import type { DrizzleDatabase } from '../../database/drizzle.types';
import { FixedWindowProjectRateLimiter } from '../../rate-limit/fixed-window-project-rate-limiter';
import { CachingProjectRepository } from '../../repositories/caching-project.repository';
import { DrizzleEventRepository } from '../../repositories/drizzle-event.repository';
import { DrizzleProjectRepository } from '../../repositories/drizzle-project.repository';
import { IngestController } from './ingest.controller';

@Module({
  controllers: [IngestController],
  providers: [
    IngestBatchUseCase,
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: PROJECT_REPOSITORY,
      inject: [DRIZZLE_CLIENT, CLOCK],
      useFactory: (db: DrizzleDatabase, clock: Clock) =>
        new CachingProjectRepository(new DrizzleProjectRepository(db), clock),
    },
    { provide: EVENT_REPOSITORY, useClass: DrizzleEventRepository },
    { provide: PROJECT_RATE_LIMITER, useValue: new FixedWindowProjectRateLimiter() },
  ],
})
export class IngestModule {}
