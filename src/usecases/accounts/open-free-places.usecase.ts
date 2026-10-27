import { Logger } from '@nestjs/common';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { AccountRepository } from '../../domain/repositories/account.repository';

export class OpenFreePlacesUseCase {
  private readonly logger = new Logger(OpenFreePlacesUseCase.name);

  constructor(
    private readonly accounts: AccountRepository,
    private readonly settings: Pick<SignUpSettings, 'freePlanOpen' | 'freeAccountsMax'>,
  ) {}

  async execute(): Promise<number> {
    if (!this.settings.freePlanOpen) {
      return 0;
    }
    const opened = await this.accounts.openWaitingAccounts(this.settings.freeAccountsMax);
    if (opened > 0) {
      this.logger.log({ message: 'accounts.free_places_opened', opened });
    }
    return opened;
  }
}
