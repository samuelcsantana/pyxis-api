import type { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import type { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import type { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import type { LinkSubscriptionUseCase } from '../usecases/billing/link-subscription.usecase';
import type { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import type { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import type { DeleteProjectUseCase } from '../usecases/projects/delete-project.usecase';
import type { ReportProjectUsageUseCase } from '../usecases/projects/report-project-usage.usecase';
import type { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import type { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';

export interface CliContext {
  readonly createProject: CreateProjectUseCase;
  readonly createProjectKey: CreateProjectKeyUseCase;
  readonly revokeProjectKey: RevokeProjectKeyUseCase;
  readonly updateProject: UpdateProjectUseCase;
  readonly deleteProject: DeleteProjectUseCase;
  readonly reportUsage: ReportProjectUsageUseCase;
  readonly grantAdminAccess: GrantAdminAccessUseCase;
  readonly createCompedAccount: CreateCompedAccountUseCase;
  readonly showAccount: ShowAccountUseCase;
  readonly linkSubscription: LinkSubscriptionUseCase;
  close(): Promise<void>;
}

export interface CommandOutput {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

export interface CliCommand<Args> {
  readonly usage: string;
  parse(argv: readonly string[]): Args;
  execute(context: CliContext, args: Args, output: CommandOutput): Promise<void>;
}
