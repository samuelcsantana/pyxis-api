import { FixedClock } from './fixed-clock';
import { InMemoryProjectRepository } from './in-memory-project.repository';
import { SequenceRandomSource } from './sequence-random-source';
import { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
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
  closed: boolean;
} {
  const store = new InMemoryProjectRepository();
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const context = {
    store,
    closed: false,
    createProject: new CreateProjectUseCase(store, random),
    createProjectKey: new CreateProjectKeyUseCase(store, store, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(
      store,
      new FixedClock(new Date('2026-10-06T14:00:00.000Z')),
    ),
    updateProject: new UpdateProjectUseCase(store),
    close: () => {
      context.closed = true;
      return Promise.resolve();
    },
  };
  return context;
}
