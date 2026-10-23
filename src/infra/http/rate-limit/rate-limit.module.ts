import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLERS } from './rate-limits';

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [...THROTTLERS], setHeaders: false })],
})
export class RateLimitModule {}
