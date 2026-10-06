import { Logger } from '@nestjs/common';
import {
  type DatabaseSizeProbe,
  type DatabaseSizeReport,
  databaseSizeReport,
} from '../../domain/monitoring/database-size';

export class ReportDatabaseSizeUseCase {
  private readonly logger = new Logger(ReportDatabaseSizeUseCase.name);

  constructor(private readonly probe: DatabaseSizeProbe) {}

  async execute(): Promise<DatabaseSizeReport> {
    const report = databaseSizeReport(await this.probe.currentBytes());
    this.logger.log({ message: 'database.size', ...report });
    return report;
  }
}
