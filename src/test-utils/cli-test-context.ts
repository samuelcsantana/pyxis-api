import { FixedClock } from './fixed-clock';
import { InMemoryAccountUsageRepository } from './in-memory-account-usage.repository';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';
import { InMemoryProjectRepository } from './in-memory-project.repository';
import { SequenceRandomSource } from './sequence-random-source';
import { StubProjectUsageQuery } from './stub-project-usage.query';
import { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
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
  readonly usage: StubProjectUsageQuery;
  closed: boolean;
} {
  const store = new InMemoryProjectRepository();
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  const accountUsage = new InMemoryAccountUsageRepository();
  const usage = new StubProjectUsageQuery();
  const clock = new FixedClock(new Date('2026-10-06T14:00:00.000Z'));
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const context = {
    store,
    admins,
    accounts,
    accountUsage,
    usage,
    closed: false,
    createProject: new CreateProjectUseCase(store, random),
    createProjectKey: new CreateProjectKeyUseCase(store, store, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(store, clock),
    updateProject: new UpdateProjectUseCase(store),
    deleteProject: new DeleteProjectUseCase(store),
    reportUsage: new ReportProjectUsageUseCase(usage, clock),
    grantAdminAccess: new GrantAdminAccessUseCase(store, admins),
    createCompedAccount: new CreateCompedAccountUseCase(admins, accounts),
    showAccount: new ShowAccountUseCase(accounts, accountUsage, clock),
    close: () => {
      context.closed = true;
      return Promise.resolve();
    },
  };
  return context;
}
