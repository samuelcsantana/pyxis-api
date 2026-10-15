import { ConsoleLogger, Logger } from '@nestjs/common';
import { validateEnv } from '../config/env.schema';
import { SystemClock } from '../infra/clock/system-clock';
import { createDrizzleDatabase, createPostgresClient } from '../infra/database/postgres-client';
import { createBillingGateway } from '../infra/billing/create-billing-gateway';
import { createMailSender } from '../infra/mail/create-mail-sender';
import { LazyMailSender } from '../infra/mail/lazy-mail-sender';
import { DrizzleDigestRecipientsQuery } from '../infra/queries/drizzle-digest-recipients.query';
import { DrizzleOverviewQuery } from '../infra/queries/drizzle-overview.query';
import { DrizzleProjectActivityQuery } from '../infra/queries/drizzle-project-activity.query';
import { DrizzleRequestsQuery } from '../infra/queries/drizzle-requests.query';
import { DrizzleAccountBillingRepository } from '../infra/repositories/drizzle-account-billing.repository';
import { DrizzleAccountLifecycleRepository } from '../infra/repositories/drizzle-account-lifecycle.repository';
import { DrizzleAccountUsageRepository } from '../infra/repositories/drizzle-account-usage.repository';
import { DrizzleDigestDeliveryRepository } from '../infra/repositories/drizzle-digest-delivery.repository';
import { DrizzleRetentionRepository } from '../infra/repositories/drizzle-retention.repository';
import { DrizzleProjectIconRepository } from '../infra/repositories/drizzle-project-icon.repository';
import { PostgresDatabaseSizeProbe } from '../infra/repositories/postgres-database-size.probe';
import { HttpSiteIconFetcher } from '../infra/site-icons/http-site-icon-fetcher';
import { ReportDatabaseSizeUseCase } from '../usecases/monitoring/report-database-size.usecase';
import { MeasureAccountUsageUseCase } from '../usecases/accounts/measure-account-usage.usecase';
import { RunAccountLifecycleUseCase } from '../usecases/accounts/run-account-lifecycle.usecase';
import { DrizzleProjectlessPeopleRepository } from '../infra/repositories/drizzle-projectless-people.repository';
import { SweepProjectlessPeopleUseCase } from '../usecases/people/sweep-projectless-people.usecase';
import { ProcessProjectExportUseCase } from '../usecases/exports/process-project-export.usecase';
import { createExportStorage } from '../infra/exports/s3-export-storage';
import { DrizzleProjectExportRepository } from '../infra/repositories/drizzle-project-export.repository';
import { WelcomeAccountsUseCase } from '../usecases/accounts/welcome-accounts.usecase';
import { signUpSettingsFromEnv } from '../infra/http/accounts/sign-up-settings-from-env';
import { DrizzleAccountWelcomeRepository } from '../infra/repositories/drizzle-account-welcome.repository';
import { BuildWeeklyDigestUseCase } from '../usecases/digest/build-weekly-digest.usecase';
import { SendWeeklyDigestsUseCase } from '../usecases/digest/send-weekly-digests.usecase';
import { RefreshProjectIconsUseCase } from '../usecases/projects/refresh-project-icons.usecase';
import { RunRetentionUseCase } from '../usecases/retention/run-retention.usecase';
import { DrizzleNoticeRepository } from '../infra/repositories/drizzle-notice.repository';
import { SendOperatorNoticesUseCase } from '../usecases/notices/send-operator-notices.usecase';
import { createJobsHandler } from './jobs-handler';
import { loadParameters, ssmParameterPages } from './load-parameters';

Logger.overrideLogger(new ConsoleLogger({ json: true }));

function exportProcessor(
  database: ReturnType<typeof createDrizzleDatabase>,
): ProcessProjectExportUseCase {
  const env = validateEnv(process.env);
  const repository = new DrizzleProjectExportRepository(database);
  return new ProcessProjectExportUseCase(
    repository,
    repository,
    createExportStorage(env.EXPORT_BUCKET),
    new LazyMailSender(() => createMailSender(env)),
    new SystemClock(),
  );
}

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
  measureAccountUsage: () =>
    withDatabase((database) =>
      new MeasureAccountUsageUseCase(
        new DrizzleAccountUsageRepository(database),
        new LazyMailSender(() => createMailSender(validateEnv(process.env))),
        new SystemClock(),
      ).execute(),
    ),
  runAccountLifecycle: () =>
    withDatabase((database) => {
      const env = validateEnv(process.env);
      const mail = new LazyMailSender(() => createMailSender(env));
      const clock = new SystemClock();
      return new RunAccountLifecycleUseCase(
        new DrizzleAccountLifecycleRepository(database),
        new DrizzleAccountBillingRepository(database),
        createBillingGateway(env),
        mail,
        clock,
        new WelcomeAccountsUseCase(
          new DrizzleAccountWelcomeRepository(database),
          mail,
          clock,
          signUpSettingsFromEnv(env),
        ),
        new SweepProjectlessPeopleUseCase(new DrizzleProjectlessPeopleRepository(database), clock),
      ).execute();
    }),
  processExport: (exportId) =>
    withDatabase((database) => exportProcessor(database).execute(exportId)),
  processStalledExports: () =>
    withDatabase((database) => exportProcessor(database).processStalled()),
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
  sendOperatorNotices: () =>
    withDatabase((database) =>
      new SendOperatorNoticesUseCase(
        new DrizzleNoticeRepository(database),
        new LazyMailSender(() => createMailSender(validateEnv(process.env))),
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
