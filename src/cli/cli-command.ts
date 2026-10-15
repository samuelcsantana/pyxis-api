import type { CloseAccountAsOperatorUseCase } from '../usecases/accounts/close-account-as-operator.usecase';
import type { CreateCompedAccountUseCase } from '../usecases/accounts/create-comped-account.usecase';
import type { HoldAccountDeletionUseCase } from '../usecases/accounts/hold-account-deletion.usecase';
import type { ReleaseAccountDeletionUseCase } from '../usecases/accounts/release-account-deletion.usecase';
import type { ResumeAccountUseCase } from '../usecases/accounts/resume-account.usecase';
import type { ShowAccountUseCase } from '../usecases/accounts/show-account.usecase';
import type { SuspendAccountUseCase } from '../usecases/accounts/suspend-account.usecase';
import type { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import type { ResumeAdminUseCase } from '../usecases/auth/resume-admin.usecase';
import type { RevokeAccessTokenAsOperatorUseCase } from '../usecases/auth/revoke-access-token-as-operator.usecase';
import type { SuspendAdminUseCase } from '../usecases/auth/suspend-admin.usecase';
import type { LinkSubscriptionUseCase } from '../usecases/billing/link-subscription.usecase';
import type { RevokeAdminAccessUseCase } from '../usecases/people/revoke-admin-access.usecase';
import type { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import type { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import type { DeleteProjectUseCase } from '../usecases/projects/delete-project.usecase';
import type { ReportProjectUsageUseCase } from '../usecases/projects/report-project-usage.usecase';
import type { HoldProjectDeletionUseCase } from '../usecases/projects/hold-project-deletion.usecase';
import type { ReleaseProjectDeletionUseCase } from '../usecases/projects/release-project-deletion.usecase';
import type { ResumeProjectIngestionUseCase } from '../usecases/projects/resume-project-ingestion.usecase';
import type { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import type { SuspendProjectIngestionUseCase } from '../usecases/projects/suspend-project-ingestion.usecase';
import type { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';

export interface CliContext {
  readonly createProject: CreateProjectUseCase;
  readonly createProjectKey: CreateProjectKeyUseCase;
  readonly revokeProjectKey: RevokeProjectKeyUseCase;
  readonly updateProject: UpdateProjectUseCase;
  readonly deleteProject: DeleteProjectUseCase;
  readonly reportUsage: ReportProjectUsageUseCase;
  readonly grantAdminAccess: GrantAdminAccessUseCase;
  readonly revokeAdminAccess: RevokeAdminAccessUseCase;
  readonly createCompedAccount: CreateCompedAccountUseCase;
  readonly showAccount: ShowAccountUseCase;
  readonly linkSubscription: LinkSubscriptionUseCase;
  readonly suspendAccount: SuspendAccountUseCase;
  readonly resumeAccount: ResumeAccountUseCase;
  readonly closeAccountAsOperator: CloseAccountAsOperatorUseCase;
  readonly holdAccountDeletion: HoldAccountDeletionUseCase;
  readonly releaseAccountDeletion: ReleaseAccountDeletionUseCase;
  readonly suspendAdmin: SuspendAdminUseCase;
  readonly resumeAdmin: ResumeAdminUseCase;
  readonly revokeAccessToken: RevokeAccessTokenAsOperatorUseCase;
  readonly suspendProjectIngestion: SuspendProjectIngestionUseCase;
  readonly resumeProjectIngestion: ResumeProjectIngestionUseCase;
  readonly holdProjectDeletion: HoldProjectDeletionUseCase;
  readonly releaseProjectDeletion: ReleaseProjectDeletionUseCase;
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
