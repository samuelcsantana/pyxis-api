import { Inject, Injectable } from '@nestjs/common';
import { type Annotation, requireAnnotationText } from '../../domain/annotations/annotation';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { changeableProject } from '../projects/owned-project';
import { addAnnotation } from './add-annotation';

export interface CreateAnnotationCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly day: string;
  readonly text: string;
}

@Injectable()
export class CreateAnnotationUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ANNOTATION_REPOSITORY) private readonly annotations: AnnotationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CreateAnnotationCommand): Promise<Annotation> {
    const text = requireAnnotationText(command.text);
    const { project } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    return addAnnotation(this.annotations, project, { day: command.day, text }, this.clock.now());
  }
}
