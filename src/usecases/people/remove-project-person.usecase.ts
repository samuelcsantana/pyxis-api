import { Inject, Injectable } from '@nestjs/common';
import { OwnerStaysError, PersonNotFoundError } from '../../domain/errors/people.errors';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_PEOPLE_REPOSITORY,
  type ProjectPeopleRepository,
} from '../../domain/repositories/project-people.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { projectOwnedBy } from '../projects/owned-project';

export interface RemoveProjectPersonCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly personId: string;
}

@Injectable()
export class RemoveProjectPersonUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_PEOPLE_REPOSITORY) private readonly people: ProjectPeopleRepository,
  ) {}

  async execute(command: RemoveProjectPersonCommand): Promise<void> {
    const { account } = await projectOwnedBy(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    if (command.personId === account.ownerAdminId) {
      throw new OwnerStaysError();
    }
    if (!(await this.people.remove(command.projectId, command.personId))) {
      throw new PersonNotFoundError();
    }
  }
}
