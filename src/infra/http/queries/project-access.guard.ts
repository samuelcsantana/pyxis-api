import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { AccountSuspendedError } from '../../../domain/errors/account.errors';
import { isUuid } from '../../../domain/events/text-shapes';
import type { Goal } from '../../../domain/goals/goal';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../../domain/repositories/admin-user.repository';
import { GOAL_REPOSITORY, type GoalRepository } from '../../../domain/repositories/goal.repository';
import {
  PROJECT_ACCOUNT_STATE_REPOSITORY,
  type ProjectAccountStateRepository,
} from '../../../domain/repositories/project-account-state.repository';
import { adminOf } from '../auth/auth.guards';

declare module 'fastify' {
  interface FastifyRequest {
    project?: Project;
    goals?: readonly Goal[];
  }
}

type ProjectRequest = FastifyRequest<{ Params: Partial<Record<'projectId', string>> }>;

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository,
    @Inject(PROJECT_ACCOUNT_STATE_REPOSITORY)
    private readonly accountStates: ProjectAccountStateRepository,
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProjectRequest>();
    const projectId = request.params.projectId ?? '';
    const project = isUuid(projectId)
      ? await this.admins.accessibleProject(adminOf(request).id, projectId.toLowerCase())
      : null;
    if (project === null) {
      throw new NotFoundException();
    }
    const [state, goals] = await Promise.all([
      this.accountStates.stateOf(project.id),
      this.goals.listByProject(project.id),
    ]);
    if (state.suspended) {
      throw new AccountSuspendedError();
    }
    request.project = project;
    request.goals = goals;
    return true;
  }
}

export function projectOf(request: FastifyRequest): Project {
  if (request.project === undefined) {
    throw new Error('ProjectAccessGuard must run before a route reads the project.');
  }
  return request.project;
}

export function goalsOf(request: FastifyRequest): readonly Goal[] {
  if (request.goals === undefined) {
    throw new Error('ProjectAccessGuard must run before a route reads the goals.');
  }
  return request.goals;
}
