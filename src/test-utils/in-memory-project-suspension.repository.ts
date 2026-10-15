import {
  NO_RESTRICTIONS,
  type ProjectRestrictions,
  type ProjectRestrictionsQuery,
} from '../domain/queries/project-restrictions';
import type {
  ProjectIngestionSuspension,
  ProjectSuspensionRepository,
} from '../domain/repositories/project-suspension.repository';

interface RestrictedProject extends ProjectIngestionSuspension {
  readonly ownerAdminId: string | null;
}

export class InMemoryProjectSuspensionRepository
  implements ProjectSuspensionRepository, ProjectRestrictionsQuery
{
  private readonly projects = new Map<string, RestrictedProject>();

  add(projectId: string, projectName: string, ownerAdminId: string | null = null): void {
    this.projects.set(projectId, {
      projectId,
      projectName,
      suspendedAt: null,
      reason: null,
      ownerAdminId,
    });
  }

  suspensionOf(projectId: string): Promise<ProjectIngestionSuspension | null> {
    return Promise.resolve(this.withoutOwner(this.projects.get(projectId)));
  }

  suspend(projectId: string, reason: string, at: Date): Promise<ProjectIngestionSuspension | null> {
    return Promise.resolve(this.update(projectId, { suspendedAt: at, reason }));
  }

  resume(projectId: string): Promise<ProjectIngestionSuspension | null> {
    return Promise.resolve(this.update(projectId, { suspendedAt: null, reason: null }));
  }

  restrictionsOf(
    adminUserId: string,
    projectIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProjectRestrictions>> {
    return Promise.resolve(
      new Map(
        projectIds.flatMap((projectId) => {
          const project = this.projects.get(projectId);
          return project === undefined
            ? []
            : [
                [
                  projectId,
                  {
                    ...NO_RESTRICTIONS,
                    ingestionSuspendedAt: project.suspendedAt,
                    ingestionSuspensionReason:
                      project.ownerAdminId === adminUserId ? project.reason : null,
                  },
                ] as const,
              ];
        }),
      ),
    );
  }

  private update(
    projectId: string,
    changes: Pick<ProjectIngestionSuspension, 'suspendedAt' | 'reason'>,
  ): ProjectIngestionSuspension | null {
    const project = this.projects.get(projectId);
    if (project === undefined) {
      return null;
    }
    const updated = { ...project, ...changes };
    this.projects.set(projectId, updated);
    return this.withoutOwner(updated);
  }

  private withoutOwner(project: RestrictedProject | undefined): ProjectIngestionSuspension | null {
    if (project === undefined) {
      return null;
    }
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      suspendedAt: project.suspendedAt,
      reason: project.reason,
    };
  }
}
