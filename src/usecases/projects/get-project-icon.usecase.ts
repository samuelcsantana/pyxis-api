import { Inject, Injectable } from '@nestjs/common';
import { ProjectIconNotFoundError } from '../../domain/errors/project.errors';
import {
  PROJECT_ICON_REPOSITORY,
  type ProjectIcon,
  type ProjectIconRepository,
} from '../../domain/repositories/project-icon.repository';

@Injectable()
export class GetProjectIconUseCase {
  constructor(@Inject(PROJECT_ICON_REPOSITORY) private readonly icons: ProjectIconRepository) {}

  async execute(projectId: string): Promise<ProjectIcon> {
    const icon = await this.icons.find(projectId);
    if (icon === null) {
      throw new ProjectIconNotFoundError();
    }
    return icon;
  }
}
