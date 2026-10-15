import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountRole,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_PEOPLE_REPOSITORY,
  type ProjectPeopleRepository,
  type ProjectPerson,
} from '../../domain/repositories/project-people.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { ownerOfProject } from '../projects/owned-project';

export interface PersonOfProject extends ProjectPerson {
  readonly role: AccountRole;
}

@Injectable()
export class ListProjectPeopleUseCase {
  constructor(
    @Inject(PROJECT_PEOPLE_REPOSITORY) private readonly people: ProjectPeopleRepository,
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(projectId: string): Promise<readonly PersonOfProject[]> {
    const [people, ownerId] = await Promise.all([
      this.people.peopleOf(projectId),
      ownerOfProject(this.projects, this.accounts, projectId),
    ]);
    return people.map((person) => ({
      ...person,
      role: person.adminUserId === ownerId ? 'owner' : 'member',
    }));
  }
}
