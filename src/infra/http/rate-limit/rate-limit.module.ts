import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CLIENT_BATCHES_PER_WINDOW, CLIENT_RATE_WINDOW_MS, INGEST_THROTTLER } from './rate-limits';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: INGEST_THROTTLER, ttl: CLIENT_RATE_WINDOW_MS, limit: CLIENT_BATCHES_PER_WINDOW },
      ],
      setHeaders: false,
    }),
  ],
})
export class RateLimitModule {}
