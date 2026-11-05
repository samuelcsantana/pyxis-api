import { Inject, Injectable } from '@nestjs/common';
import { requireProFeature } from '../../domain/accounts/pro-features';
import { type Annotation, requireAnnotationText } from '../../domain/annotations/annotation';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
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
import { requireAccess } from '../projects/owned-project';
import { addAnnotation, type AnnotationInput } from './add-annotation';

@Injectable()
export class CreateAnnotationByKeyUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ANNOTATION_REPOSITORY) private readonly annotations: AnnotationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(projectId: string, input: AnnotationInput): Promise<Annotation> {
    const text = requireAnnotationText(input.text);
    const project = await this.projects.findById(projectId);
    if (project === null) {
      throw new ProjectNotFoundError();
    }
    const accountId = await this.projects.accountIdOf(project.id);
    const account = accountId === null ? null : await this.accounts.findById(accountId);
    if (account !== null) {
      requireAccess(account);
    }
    requireProFeature(account, 'annotations_by_token');
    return addAnnotation(this.annotations, project, { day: input.day, text }, this.clock.now());
  }
}
