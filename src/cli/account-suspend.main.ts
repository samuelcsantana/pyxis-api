import { accountSuspendCommand } from './commands/account-suspend.command';
import { runFromProcess } from './run-from-process';

void runFromProcess(accountSuspendCommand);
