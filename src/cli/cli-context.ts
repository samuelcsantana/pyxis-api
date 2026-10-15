import postgres from 'postgres';
import { validateEnv } from '../config/env.schema';
import { SystemClock } from '../infra/clock/system-clock';
import { migrationConnectionString } from '../infra/database/migrations';
import { createDrizzleDatabase } from '../infra/database/postgres-client';
import { CONNECT_TIMEOUT_SECONDS } from '../infra/database/postgres-options';
import { DrizzleProjectUsageQuery } from '../infra/queries/drizzle-project-usage.query';
import { CryptoRandomSource } from '../infra/random/crypto-random-source';
import { DrizzleAccountUsageRepository } from '../infra/repositories/drizzle-account-usage.repository';
import { DrizzleAccountClosureRepository } from '../infra/repositories/drizzle-account-closure.repository';
import { DrizzleAccountDeletionHoldRepository } from '../infra/repositories/drizzle-account-deletion-hold.repository';
import { DrizzleAccountSuspensionRepository } from '../infra/repositories/drizzle-account-suspension.repository';
import { DrizzleAccountRepository } from '../infra/repositories/drizzle-account.repository';
import { DrizzleAccessTokenRepository } from '../infra/repositories/drizzle-access-token.repository';
import { DrizzleAdminSessionRepository } from '../infra/repositories/drizzle-admin-session.repository';
import { DrizzleAdminSuspensionRepository } from '../infra/repositories/drizzle-admin-suspension.repository';
import { DrizzleAdminUserRepository } from '../infra/repositories/drizzle-admin-user.repository';
import { DrizzleProjectKeyRepository } from '../infra/repositories/drizzle-project-key.repository';
import { DrizzleProjectSettingsRepository } from '../infra/repositories/drizzle-project-settings.repository';
import { CloseAccountAsOperatorUseCase } from '../usecases/accounts/close-account-as-operator.usecase';
import { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import { HoldAccountDeletionUseCase } from '../usecases/accounts/hold-account-deletion.usecase';
import { ReleaseAccountDeletionUseCase } from '../usecases/accounts/release-account-deletion.usecase';
import { ResumeAccountUseCase } from '../usecases/accounts/resume-account.usecase';
import { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import { SuspendAccountUseCase } from '../usecases/accounts/suspend-account.usecase';
import { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import { ResumeAdminUseCase } from '../usecases/auth/resume-admin.usecase';
import { RevokeAccessTokenAsOperatorUseCase } from '../usecases/auth/revoke-access-token-as-operator.usecase';
import { SuspendAdminUseCase } from '../usecases/auth/suspend-admin.usecase';
import { LinkSubscriptionUseCase } from '../usecases/billing/link-subscription.usecase';
import { DrizzleProjectPeopleRepository } from '../infra/repositories/drizzle-project-people.repository';
import { RevokeAdminAccessUseCase } from '../usecases/people/revoke-admin-access.usecase';
import { createBillingGateway } from '../infra/billing/create-billing-gateway';
import { DrizzleAccountBillingRepository } from '../infra/repositories/drizzle-account-billing.repository';
import { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import { DeleteProjectUseCase } from '../usecases/projects/delete-project.usecase';
import { ReportProjectUsageUseCase } from '../usecases/projects/report-project-usage.usecase';
import { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';
import type { CliContext } from './cli-command';

export function writeNoticeToStderr(notice: { readonly message?: string }): void {
  process.stderr.write(`postgres notice: ${notice.message ?? ''}\n`);
}

export function openCliContext(env: Record<string, string | undefined>): CliContext {
  const config = validateEnv(env);
  const client = postgres(migrationConnectionString(config), {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: writeNoticeToStderr,
  });
  const db = createDrizzleDatabase(client);
  const settings = new DrizzleProjectSettingsRepository(db);
  const keys = new DrizzleProjectKeyRepository(db);
  const admins = new DrizzleAdminUserRepository(db);
  const accounts = new DrizzleAccountRepository(db);
  const random = new CryptoRandomSource();
  const clock = new SystemClock();
  const suspensions = new DrizzleAccountSuspensionRepository(db);
  const billing = createBillingGateway(config);
  const holds = new DrizzleAccountDeletionHoldRepository(db);
  const adminSuspensions = new DrizzleAdminSuspensionRepository(db);
  const accessTokens = new DrizzleAccessTokenRepository(db);
  return {
    createProject: new CreateProjectUseCase(settings, random),
    createProjectKey: new CreateProjectKeyUseCase(settings, keys, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(keys, clock),
    updateProject: new UpdateProjectUseCase(settings),
    deleteProject: new DeleteProjectUseCase(settings),
    reportUsage: new ReportProjectUsageUseCase(new DrizzleProjectUsageQuery(db), clock),
    grantAdminAccess: new GrantAdminAccessUseCase(settings, admins),
    revokeAdminAccess: new RevokeAdminAccessUseCase(
      admins,
      settings,
      accounts,
      new DrizzleProjectPeopleRepository(db),
    ),
    createCompedAccount: new CreateCompedAccountUseCase(admins, accounts),
    showAccount: new ShowAccountUseCase(accounts, new DrizzleAccountUsageRepository(db), clock),
    linkSubscription: new LinkSubscriptionUseCase(
      billing,
      new DrizzleAccountBillingRepository(db),
      clock,
    ),
    suspendAccount: new SuspendAccountUseCase(accounts, suspensions, clock),
    resumeAccount: new ResumeAccountUseCase(suspensions),
    closeAccountAsOperator: new CloseAccountAsOperatorUseCase(
      accounts,
      new DrizzleAccountClosureRepository(db),
      billing,
      clock,
    ),
    holdAccountDeletion: new HoldAccountDeletionUseCase(accounts, holds, clock),
    releaseAccountDeletion: new ReleaseAccountDeletionUseCase(holds),
    suspendAdmin: new SuspendAdminUseCase(
      admins,
      adminSuspensions,
      new DrizzleAdminSessionRepository(db),
      accessTokens,
      clock,
    ),
    resumeAdmin: new ResumeAdminUseCase(admins, adminSuspensions),
    revokeAccessToken: new RevokeAccessTokenAsOperatorUseCase(accessTokens, clock),
    close: () => client.end(),
  };
}
