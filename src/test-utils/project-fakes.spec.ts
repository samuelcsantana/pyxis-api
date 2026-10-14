import { InMemoryProjectRepository } from './in-memory-project.repository';

describe('InMemoryProjectRepository', () => {
  it('answers null when asked to delete a project it does not have, as the database does', async () => {
    const projects = new InMemoryProjectRepository();

    expect(await projects.deleteWithEverything('missing-project')).toBeNull();
  });
});
