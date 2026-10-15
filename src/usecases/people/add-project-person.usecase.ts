import { Inject, Injectable, Logger } from '@nestjs/common';
import { HOSTED_PLAN_LIMITS } from '../../domain/accounts/hosted-plan';
import { normalizeEmail } from '../../domain/auth/email';
import type { EmailLanguage } from '../../domain/auth/email-language';
import { PeopleLimitReachedError } from '../../domain/errors/people.errors';
import type { Invitation } from '../../domain/people/invitation';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
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
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { changeableProject } from '../projects/owned-project';

export interface AddProjectPersonCommand {
  readonly adminUserId: string;
  readonly inviterEmail: string;
  readonly projectId: string;
  readonly email: string;
  readonly language: EmailLanguage;
}

export interface AddedPerson {
  readonly person: ProjectPerson;
  readonly added: boolean;
}

@Injectable()
export class AddProjectPersonUseCase {
  private readonly logger = new Logger(AddProjectPersonUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROJECT_PEOPLE_REPOSITORY) private readonly people: ProjectPeopleRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  async execute(command: AddProjectPersonCommand): Promise<AddedPerson> {
    const { project, account } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    const maxPeople = HOSTED_PLAN_LIMITS.people;
    const addition = await this.people.addToAccountProject(
      normalizeEmail(command.email),
      project.id,
      { accountId: account.id, maxPeople },
    );
    switch (addition.outcome) {
      case 'people_limit_reached':
        throw new PeopleLimitReachedError(maxPeople);
      case 'already_there':
        return { person: addition.person, added: false };
      case 'added':
        await this.tryInviting(
          addition.person.email,
          { projectName: project.name, inviterEmail: command.inviterEmail },
          command.language,
        );
        return { person: addition.person, added: true };
    }
  }

  private async tryInviting(
    email: string,
    invitation: Invitation,
    language: EmailLanguage,
  ): Promise<void> {
    try {
      await this.mail.sendInvitation(email, invitation, language);
    } catch (error) {
      this.logger.error({ message: 'people.invitation_failed', reason: String(error) });
    }
  }
}
