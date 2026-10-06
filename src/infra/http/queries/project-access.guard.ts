import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { isUuid } from '../../../domain/events/text-shapes';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../../domain/repositories/admin-user.repository';
import { adminOf } from '../auth/auth.guards';

declare module 'fastify' {
  interface FastifyRequest {
    project?: Project;
  }
}

type ProjectRequest = FastifyRequest<{ Params: Partial<Record<'projectId', string>> }>;

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly admins: AdminUserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProjectRequest>();
    const projectId = request.params.projectId ?? '';
    const project = isUuid(projectId)
      ? await this.admins.accessibleProject(adminOf(request).id, projectId.toLowerCase())
      : null;
    if (project === null) {
      throw new NotFoundException();
    }
    request.project = project;
    return true;
  }
}

export function projectOf(request: FastifyRequest): Project {
  if (request.project === undefined) {
    throw new Error('ProjectAccessGuard must run before a route reads the project.');
  }
  return request.project;
}
