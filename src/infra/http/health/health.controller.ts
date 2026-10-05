import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  readonly status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
