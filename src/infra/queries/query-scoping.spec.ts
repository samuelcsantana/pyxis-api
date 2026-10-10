import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const QUERY_ADAPTER_FILE = /^drizzle-.+\.query\.ts$/;
const SCOPED_TO_ONE_PROJECT = /inScope\(|projectId/;

function queryAdapterFiles(): readonly string[] {
  return readdirSync(__dirname)
    .filter((name) => QUERY_ADAPTER_FILE.test(name))
    .sort();
}

describe('dashboard query adapters', () => {
  it.each(queryAdapterFiles())('%s reads the events of one project only', (file) => {
    expect(readFileSync(join(__dirname, file), 'utf8')).toMatch(SCOPED_TO_ONE_PROJECT);
  });
});
