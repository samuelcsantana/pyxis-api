import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUBJECT_EVENTS_REPOSITORY,
  type SubjectEventsRepository,
} from '../../domain/subjects/subject-events';

export interface ErasedSubject {
  readonly deletedEvents: number;
}

@Injectable()
export class EraseSubjectUseCase {
  private readonly logger = new Logger(EraseSubjectUseCase.name);

  constructor(
    @Inject(SUBJECT_EVENTS_REPOSITORY) private readonly events: SubjectEventsRepository,
  ) {}

  async execute(projectId: string, userId: string): Promise<ErasedSubject> {
    const deletedEvents = await this.events.erase(projectId, userId);
    this.logger.log({ message: 'subject.erased', projectId, deletedEvents });
    return { deletedEvents };
  }
}
