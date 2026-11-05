import { Inject, Injectable } from '@nestjs/common';
import { AnnotationNotFoundError } from '../../domain/errors/annotation.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  ANNOTATION_REPOSITORY,
  type AnnotationRepository,
} from '../../domain/repositories/annotation.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { changeableProject } from '../projects/owned-project';

export interface DeleteAnnotationCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly annotationId: string;
}

@Injectable()
export class DeleteAnnotationUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ANNOTATION_REPOSITORY) private readonly annotations: AnnotationRepository,
  ) {}

  async execute(command: DeleteAnnotationCommand): Promise<void> {
    const { project } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    if (!(await this.annotations.delete(project.id, command.annotationId))) {
      throw new AnnotationNotFoundError();
    }
  }
}
