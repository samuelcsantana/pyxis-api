import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type HealthStatus, healthStatusSchema } from './health.schema';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check of the API' })
  @ApiOkResponse({ description: 'The API is up.', standardSchema: healthStatusSchema })
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
