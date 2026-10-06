import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AUTH_THROTTLER,
  CLIENT_BATCHES_PER_WINDOW,
  CLIENT_RATE_WINDOW_MS,
  INGEST_THROTTLER,
  SIGN_IN_RATE_WINDOW_MS,
  SIGN_IN_REQUESTS_PER_WINDOW,
} from './rate-limits';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: INGEST_THROTTLER, ttl: CLIENT_RATE_WINDOW_MS, limit: CLIENT_BATCHES_PER_WINDOW },
        { name: AUTH_THROTTLER, ttl: SIGN_IN_RATE_WINDOW_MS, limit: SIGN_IN_REQUESTS_PER_WINDOW },
      ],
      setHeaders: false,
    }),
  ],
})
export class RateLimitModule {}
