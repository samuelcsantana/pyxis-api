import { FakeBillingGateway } from './fake-billing-gateway';
import { FixedClock } from './fixed-clock';
import { InMemoryAccountBillingRepository } from './in-memory-account-billing.repository';
import { InMemoryAccountClosureRepository } from './in-memory-account-closure.repository';
import { InMemoryAccountUsageRepository } from './in-memory-account-usage.repository';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';
import { InMemoryProjectPeopleRepository } from './in-memory-project-people.repository';
import { InMemoryProjectRepository } from './in-memory-project.repository';
import { SequenceRandomSource } from './sequence-random-source';
import { StubProjectUsageQuery } from './stub-project-usage.query';
import { CloseAccountAsOperatorUseCase } from '../usecases/accounts/close-account-as-operator.usecase';
import { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import { ResumeAccountUseCase } from '../usecases/accounts/resume-account.usecase';
import { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import { SuspendAccountUseCase } from '../usecases/accounts/suspend-account.usecase';
import { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import { LinkSubscriptionUseCase } from '../usecases/billing/link-subscription.usecase';
import { RevokeAdminAccessUseCase } from '../usecases/people/revoke-admin-access.usecase';
import { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import { DeleteProjectUseCase } from '../usecases/projects/delete-project.usecase';
import { ReportProjectUsageUseCase } from '../usecases/projects/report-project-usage.usecase';
import { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
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
  readonly people: InMemoryProjectPeopleRepository;
  readonly usage: StubProjectUsageQuery;
  closed: boolean;
} {
  const store = new InMemoryProjectRepository();
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  const accountUsage = new InMemoryAccountUsageRepository();
  const billing = new FakeBillingGateway();
  const accountBilling = new InMemoryAccountBillingRepository();
  const closure = new InMemoryAccountClosureRepository();
  const people = new InMemoryProjectPeopleRepository();
  const usage = new StubProjectUsageQuery();
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
    people,
    usage,
    closed: false,
    createProject: new CreateProjectUseCase(store, random),
    createProjectKey: new CreateProjectKeyUseCase(store, store, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(store, clock),
    updateProject: new UpdateProjectUseCase(store),
    deleteProject: new DeleteProjectUseCase(store),
    reportUsage: new ReportProjectUsageUseCase(usage, clock),
    grantAdminAccess: new GrantAdminAccessUseCase(store, admins),
    revokeAdminAccess: new RevokeAdminAccessUseCase(admins, store, accounts, people),
    createCompedAccount: new CreateCompedAccountUseCase(admins, accounts),
    showAccount: new ShowAccountUseCase(accounts, accountUsage, clock),
    linkSubscription: new LinkSubscriptionUseCase(billing, accountBilling, clock),
    suspendAccount: new SuspendAccountUseCase(accounts, accounts, clock),
    resumeAccount: new ResumeAccountUseCase(accounts),
    closeAccountAsOperator: new CloseAccountAsOperatorUseCase(accounts, closure, billing, clock),
    close: () => {
      context.closed = true;
      return Promise.resolve();
    },
  };
  return context;
}
