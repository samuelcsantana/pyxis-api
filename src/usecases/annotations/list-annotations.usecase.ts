import { Inject, Injectable } from '@nestjs/common';
import type { Annotation } from '../../domain/annotations/annotation';
import type { Project } from '../../domain/entities/project.entity';
import { checkedRange, todayIn } from '../../domain/queries/date-range';
import {
  ANNOTATION_REPOSITORY,
  type AnnotationRepository,
} from '../../domain/repositories/annotation.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class ListAnnotationsUseCase {
  constructor(
    @Inject(ANNOTATION_REPOSITORY) private readonly annotations: AnnotationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(project: Project, from: string, to: string): Promise<readonly Annotation[]> {
    const range = checkedRange(from, to, todayIn(project.timezone, this.clock.now()));
    return await this.annotations.listInRange(project.id, range);
  }
}
