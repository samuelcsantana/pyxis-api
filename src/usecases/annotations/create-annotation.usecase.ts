import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type Annotation,
  MAX_ANNOTATIONS_PER_PROJECT,
  requireAnnotationDay,
  requireAnnotationText,
} from '../../domain/annotations/annotation';
import { AnnotationLimitReachedError } from '../../domain/errors/annotation.errors';
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

export interface CreateAnnotationCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly day: string;
  readonly text: string;
}

@Injectable()
export class CreateAnnotationUseCase {
  private readonly logger = new Logger(CreateAnnotationUseCase.name);

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
    const now = this.clock.now();
    const day = requireAnnotationDay(command.day, todayIn(project.timezone, now));
    const created = await this.annotations.create(
      project.id,
      { day, text },
      now,
      MAX_ANNOTATIONS_PER_PROJECT,
    );
    if (created.outcome === 'limit_reached') {
      throw new AnnotationLimitReachedError(MAX_ANNOTATIONS_PER_PROJECT);
    }
    this.logger.log({
      message: 'annotation.created',
      projectId: project.id,
      annotationId: created.annotation.id,
    });
    return created.annotation;
  }
}
