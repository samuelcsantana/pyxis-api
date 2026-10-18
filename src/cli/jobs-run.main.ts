import { handler } from '../lambda/jobs-entry';
import { runJobs } from './jobs-run';

void runJobs(handler, process.argv.slice(2), {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
}).then((exitCode) => {
  process.exitCode = exitCode;
});
