import { FakeBillingGateway } from './fake-billing-gateway';
import { FixedClock } from './fixed-clock';
import { InMemoryAccessTokenRepository } from './in-memory-access-token.repository';
import { InMemoryOAuthConnectionRepository } from './in-memory-oauth-connection.repository';
import { InMemoryAccountBillingRepository } from './in-memory-account-billing.repository';
import { InMemoryAdminSessionRepository } from './in-memory-admin-session.repository';
import { InMemoryAccountClosureRepository } from './in-memory-account-closure.repository';
import { InMemoryAccountUsageRepository } from './in-memory-account-usage.repository';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';
import { InMemoryProjectPeopleRepository } from './in-memory-project-people.repository';
import { InMemoryProjectRepository } from './in-memory-project.repository';
import { InMemoryNoticeRepository } from './in-memory-notice.repository';
import { InMemoryProjectSuspensionRepository } from './in-memory-project-suspension.repository';
import { InMemoryProjectDeletionHoldRepository } from './in-memory-project-deletion-hold.repository';
import { InMemoryDemoTrafficRepository } from './in-memory-demo-traffic.repository';
import { InMemoryReviewerCodeRepository } from './in-memory-reviewer-code.repository';
import { SequenceRandomSource } from './sequence-random-source';
import { StubProjectUsageQuery } from './stub-project-usage.query';
import { CloseAccountAsOperatorUseCase } from '../usecases/accounts/close-account-as-operator.usecase';
import { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import { ExemptAccountFromQuotaPauseUseCase } from '../usecases/accounts/exempt-account-from-quota-pause.usecase';
import { SetAccountPlanLimitsUseCase } from '../usecases/accounts/set-account-plan-limits.usecase';
import { HoldAccountDeletionUseCase } from '../usecases/accounts/hold-account-deletion.usecase';
import { ReleaseAccountDeletionUseCase } from '../usecases/accounts/release-account-deletion.usecase';
import { ResumeAccountUseCase } from '../usecases/accounts/resume-account.usecase';
import { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import { SuspendAccountUseCase } from '../usecases/accounts/suspend-account.usecase';
import { CloseReviewerCodeUseCase } from '../usecases/auth/close-reviewer-code.usecase';
import { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import { OpenReviewerCodeUseCase } from '../usecases/auth/open-reviewer-code.usecase';
import { ResumeAdminUseCase } from '../usecases/auth/resume-admin.usecase';
import { RevokeAccessTokenAsOperatorUseCase } from '../usecases/auth/revoke-access-token-as-operator.usecase';
import { SuspendAdminUseCase } from '../usecases/auth/suspend-admin.usecase';
import { RevokeConnectionAsOperatorUseCase } from '../usecases/oauth/revoke-connection-as-operator.usecase';
import { LinkSubscriptionUseCase } from '../usecases/billing/link-subscription.usecase';
import { CreateOperatorNoticeUseCase } from '../usecases/notices/create-operator-notice.usecase';
import { RevokeAdminAccessUseCase } from '../usecases/people/revoke-admin-access.usecase';
import { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import { DeleteProjectUseCase } from '../usecases/projects/delete-project.usecase';
import { ReportProjectUsageUseCase } from '../usecases/projects/report-project-usage.usecase';
import { HoldProjectDeletionUseCase } from '../usecases/projects/hold-project-deletion.usecase';
import { ReleaseProjectDeletionUseCase } from '../usecases/projects/release-project-deletion.usecase';
import { ResumeProjectIngestionUseCase } from '../usecases/projects/resume-project-ingestion.usecase';
import { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import { SetDemoTrafficUseCase } from '../usecases/projects/set-demo-traffic.usecase';
import { SuspendProjectIngestionUseCase } from '../usecases/projects/suspend-project-ingestion.usecase';
import { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';
import type { CliContext, CommandOutput } from '../cli/cli-command';

export interface CapturedOutput extends CommandOutput {
  readonly out: string[];
  readonly err: string[];
}

export function captureOutput(): CapturedOutput {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
}

export function inMemoryCliContext(): CliContext & {
  readonly store: InMemoryProjectRepository;
  readonly admins: InMemoryAdminUserRepository;
  readonly accounts: InMemoryAccountRepository;
  readonly accountUsage: InMemoryAccountUsageRepository;
  readonly billing: FakeBillingGateway;
  readonly accountBilling: InMemoryAccountBillingRepository;
  readonly closure: InMemoryAccountClosureRepository;
  readonly sessions: InMemoryAdminSessionRepository;
  readonly tokens: InMemoryAccessTokenRepository;
  readonly connections: InMemoryOAuthConnectionRepository;
  readonly people: InMemoryProjectPeopleRepository;
  readonly usage: StubProjectUsageQuery;
  readonly projectSuspensions: InMemoryProjectSuspensionRepository;
  readonly projectHolds: InMemoryProjectDeletionHoldRepository;
  readonly notices: InMemoryNoticeRepository;
  readonly reviewerCodes: InMemoryReviewerCodeRepository;
  readonly demoTraffic: InMemoryDemoTrafficRepository;
  closed: boolean;
} {
  const store = new InMemoryProjectRepository();
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  const accountUsage = new InMemoryAccountUsageRepository();
  const billing = new FakeBillingGateway();
  const accountBilling = new InMemoryAccountBillingRepository();
  const closure = new InMemoryAccountClosureRepository();
  const sessions = new InMemoryAdminSessionRepository();
  const tokens = new InMemoryAccessTokenRepository();
  const connections = new InMemoryOAuthConnectionRepository();
  const people = new InMemoryProjectPeopleRepository();
  const usage = new StubProjectUsageQuery();
  const projectSuspensions = new InMemoryProjectSuspensionRepository();
  const projectHolds = new InMemoryProjectDeletionHoldRepository();
  const notices = new InMemoryNoticeRepository();
  const reviewerCodes = new InMemoryReviewerCodeRepository();
  const demoTraffic = new InMemoryDemoTrafficRepository();
  const clock = new FixedClock(new Date('2026-10-06T14:00:00.000Z'));
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const context = {
    store,
    admins,
    accounts,
    accountUsage,
    billing,
    accountBilling,
    closure,
    sessions,
    tokens,
    connections,
    people,
    usage,
    projectSuspensions,
    projectHolds,
    notices,
    reviewerCodes,
    demoTraffic,
    closed: false,
    createProject: new CreateProjectUseCase(store, random, accounts),
    createProjectKey: new CreateProjectKeyUseCase(store, store, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(store, clock),
    updateProject: new UpdateProjectUseCase(store),
    deleteProject: new DeleteProjectUseCase(store),
    reportUsage: new ReportProjectUsageUseCase(usage, clock),
    grantAdminAccess: new GrantAdminAccessUseCase(store, admins),
    revokeAdminAccess: new RevokeAdminAccessUseCase(admins, store, accounts, people),
    createCompedAccount: new CreateCompedAccountUseCase(admins, accounts),
    showAccount: new ShowAccountUseCase(accounts, accountUsage, clock),
    setAccountPlanLimits: new SetAccountPlanLimitsUseCase(accounts),
    linkSubscription: new LinkSubscriptionUseCase(billing, accountBilling, clock),
    suspendAccount: new SuspendAccountUseCase(accounts, accounts, clock),
    resumeAccount: new ResumeAccountUseCase(accounts),
    closeAccountAsOperator: new CloseAccountAsOperatorUseCase(accounts, closure, billing, clock),
    holdAccountDeletion: new HoldAccountDeletionUseCase(accounts, accounts, clock),
    releaseAccountDeletion: new ReleaseAccountDeletionUseCase(accounts),
    suspendAdmin: new SuspendAdminUseCase(admins, admins, sessions, tokens, connections, clock),
    resumeAdmin: new ResumeAdminUseCase(admins, admins),
    revokeAccessToken: new RevokeAccessTokenAsOperatorUseCase(tokens, clock),
    revokeConnection: new RevokeConnectionAsOperatorUseCase(connections, clock),
    openReviewerCode: new OpenReviewerCodeUseCase(admins, reviewerCodes, clock, random),
    closeReviewerCode: new CloseReviewerCodeUseCase(admins, reviewerCodes),
    suspendProjectIngestion: new SuspendProjectIngestionUseCase(projectSuspensions, clock),
    resumeProjectIngestion: new ResumeProjectIngestionUseCase(projectSuspensions),
    holdProjectDeletion: new HoldProjectDeletionUseCase(projectHolds, clock),
    releaseProjectDeletion: new ReleaseProjectDeletionUseCase(projectHolds),
    setDemoTraffic: new SetDemoTrafficUseCase(demoTraffic),
    exemptAccountFromQuotaPause: new ExemptAccountFromQuotaPauseUseCase(accounts),
    createOperatorNotice: new CreateOperatorNoticeUseCase(notices, clock),
    close: () => {
      context.closed = true;
      return Promise.resolve();
    },
  };
  return context;
}
