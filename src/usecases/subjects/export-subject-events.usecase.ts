import { Inject, Injectable } from '@nestjs/common';
import { UnknownCursorError } from '../../domain/errors/subject.errors';
import {
  EXPORT_PAGE_SIZE,
  SUBJECT_EVENTS_REPOSITORY,
  type SubjectEventsPage,
  type SubjectEventsRepository,
} from '../../domain/subjects/subject-events';

@Injectable()
export class ExportSubjectEventsUseCase {
  constructor(
    @Inject(SUBJECT_EVENTS_REPOSITORY) private readonly events: SubjectEventsRepository,
  ) {}

  async execute(
    projectId: string,
    userId: string,
    after: string | null,
  ): Promise<SubjectEventsPage> {
    if (after !== null && !(await this.events.hasEvent(projectId, after))) {
      throw new UnknownCursorError();
    }
    const found = await this.events.page(projectId, userId, after, EXPORT_PAGE_SIZE + 1);
    const events = found.slice(0, EXPORT_PAGE_SIZE);
    const [lastShown] = found.length > EXPORT_PAGE_SIZE ? events.slice(-1) : [];
    return { events, nextAfter: lastShown?.id ?? null };
  }
}
