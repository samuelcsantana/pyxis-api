import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import {
  TIMELINE_QUERY,
  type TimelineQuery,
  type TimelineReport,
  type TimelineSubject,
  timelinePage,
  VISITS_PER_PAGE,
} from '../../domain/queries/timeline';

@Injectable()
export class GetTimelineUseCase {
  constructor(@Inject(TIMELINE_QUERY) private readonly query: TimelineQuery) {}

  async execute(
    project: Project,
    subject: TimelineSubject,
    before: Date | null,
  ): Promise<TimelineReport> {
    const summaries = await this.query.visits(project.id, subject, before, VISITS_PER_PAGE + 1);
    const shown = summaries.slice(0, VISITS_PER_PAGE).map((visit) => visit.sessionId);
    const events = shown.length === 0 ? [] : await this.query.events(project.id, shown);
    return timelinePage(summaries, events, VISITS_PER_PAGE);
  }
}
