import { adminSuspendCommand } from './commands/admin-suspend.command';
import { runFromProcess } from './run-from-process';

void runFromProcess(adminSuspendCommand);
