import { Inject, Injectable } from '@nestjs/common';
import {
  type Annotation,
  requireAnnotationDay,
  requireAnnotationText,
} from '../../domain/annotations/annotation';
import { AnnotationNotFoundError } from '../../domain/errors/annotation.errors';
import { todayIn } from '../../domain/queries/date-range';
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

export interface UpdateAnnotationCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly annotationId: string;
  readonly day?: string;
  readonly text?: string;
}

@Injectable()
export class UpdateAnnotationUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ANNOTATION_REPOSITORY) private readonly annotations: AnnotationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: UpdateAnnotationCommand): Promise<Annotation> {
    const text = command.text === undefined ? undefined : requireAnnotationText(command.text);
    const { project } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    const now = this.clock.now();
    const day =
      command.day === undefined
        ? undefined
        : requireAnnotationDay(command.day, todayIn(project.timezone, now));
    const updated = await this.annotations.update(
      project.id,
      command.annotationId,
      { ...(day === undefined ? {} : { day }), ...(text === undefined ? {} : { text }) },
      now,
    );
    if (updated === null) {
      throw new AnnotationNotFoundError();
    }
    return updated;
  }
}
