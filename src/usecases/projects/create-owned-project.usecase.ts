import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import { ownedAccount } from '../accounts/owned-account';
import {
  type CreateProjectCommand,
  type CreateProjectResult,
  CreateProjectUseCase,
} from './create-project.usecase';
import { requireAccess } from './owned-project';

export interface CreateOwnedProjectCommand extends Omit<CreateProjectCommand, 'accountId'> {
  readonly adminUserId: string;
  readonly accountId: string;
}

@Injectable()
export class CreateOwnedProjectUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    private readonly createProject: CreateProjectUseCase,
  ) {}

  async execute(command: CreateOwnedProjectCommand): Promise<CreateProjectResult> {
    const { adminUserId, ...project } = command;
    requireAccess(await ownedAccount(this.accounts, project.accountId, adminUserId));
    return this.createProject.execute(project);
  }
}
