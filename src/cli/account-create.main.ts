import { accountCreateCommand } from './commands/account-create.command';
import { runFromProcess } from './run-from-process';

void runFromProcess(accountCreateCommand);
