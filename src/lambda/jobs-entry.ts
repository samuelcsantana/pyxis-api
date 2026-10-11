import { ConsoleLogger, Logger } from '@nestjs/common';
import { validateEnv } from '../config/env.schema';
import { SystemClock } from '../infra/clock/system-clock';
import { createDrizzleDatabase, createPostgresClient } from '../infra/database/postgres-client';
import { createMailSender } from '../infra/mail/create-mail-sender';
import { DrizzleDigestRecipientsQuery } from '../infra/queries/drizzle-digest-recipients.query';
import { DrizzleOverviewQuery } from '../infra/queries/drizzle-overview.query';
import { DrizzleProjectActivityQuery } from '../infra/queries/drizzle-project-activity.query';
import { DrizzleRequestsQuery } from '../infra/queries/drizzle-requests.query';
import { DrizzleDigestDeliveryRepository } from '../infra/repositories/drizzle-digest-delivery.repository';
import { DrizzleRetentionRepository } from '../infra/repositories/drizzle-retention.repository';
import { DrizzleProjectIconRepository } from '../infra/repositories/drizzle-project-icon.repository';
import { PostgresDatabaseSizeProbe } from '../infra/repositories/postgres-database-size.probe';
import { HttpSiteIconFetcher } from '../infra/site-icons/http-site-icon-fetcher';
import { ReportDatabaseSizeUseCase } from '../usecases/monitoring/report-database-size.usecase';
import { BuildWeeklyDigestUseCase } from '../usecases/digest/build-weekly-digest.usecase';
import { SendWeeklyDigestsUseCase } from '../usecases/digest/send-weekly-digests.usecase';
import { RefreshProjectIconsUseCase } from '../usecases/projects/refresh-project-icons.usecase';
import { RunRetentionUseCase } from '../usecases/retention/run-retention.usecase';
import { createJobsHandler } from './jobs-handler';
import { loadParameters, ssmParameterPages } from './load-parameters';

Logger.overrideLogger(new ConsoleLogger({ json: true }));

async function withDatabase<Result>(
  work: (database: ReturnType<typeof createDrizzleDatabase>) => Promise<Result>,
): Promise<Result> {
  const client = createPostgresClient(process.env.DATABASE_URL);
  try {
    return await work(createDrizzleDatabase(client));
  } finally {
    await client.end();
  }
}

export const handler = createJobsHandler({
  loadParameters: () => loadParameters(process.env, ssmParameterPages()),
  reportDatabaseSize: () =>
    withDatabase((database) =>
      new ReportDatabaseSizeUseCase(new PostgresDatabaseSizeProbe(database)).execute(),
    ),
  runRetention: () =>
    withDatabase((database) =>
      new RunRetentionUseCase(
        new DrizzleRetentionRepository(database),
        new SystemClock(),
      ).execute(),
    ),
  sendWeeklyDigests: () =>
    withDatabase((database) =>
      new SendWeeklyDigestsUseCase(
        new DrizzleDigestRecipientsQuery(database),
        new DrizzleDigestDeliveryRepository(database),
        new BuildWeeklyDigestUseCase(
          new DrizzleOverviewQuery(database),
          new DrizzleRequestsQuery(database),
          new DrizzleProjectActivityQuery(database),
        ),
        createMailSender(validateEnv(process.env)),
        new SystemClock(),
      ).execute(),
    ),
  refreshProjectIcons: () =>
    withDatabase((database) =>
      new RefreshProjectIconsUseCase(
        new DrizzleProjectIconRepository(database),
        new HttpSiteIconFetcher(),
        new SystemClock(),
      ).execute(),
    ),
});
