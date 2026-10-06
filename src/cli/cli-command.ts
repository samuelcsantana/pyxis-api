import type { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import type { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import type { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import type { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import type { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';

export interface CliContext {
  readonly createProject: CreateProjectUseCase;
  readonly createProjectKey: CreateProjectKeyUseCase;
  readonly revokeProjectKey: RevokeProjectKeyUseCase;
  readonly updateProject: UpdateProjectUseCase;
  readonly grantAdminAccess: GrantAdminAccessUseCase;
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
