import { InMemoryProjectRepository } from './in-memory-project.repository';
import { InMemoryProjectSuspensionRepository } from './in-memory-project-suspension.repository';

describe('InMemoryProjectRepository', () => {
  it('answers null when asked to delete a project it does not have, as the database does', async () => {
    const projects = new InMemoryProjectRepository();

    expect(await projects.deleteWithEverything('missing-project')).toBeNull();
  });
});

describe('InMemoryProjectSuspensionRepository', () => {
  it('answers no restriction for a project it does not have', async () => {
    const suspensions = new InMemoryProjectSuspensionRepository();

    expect(await suspensions.restrictionsOf('admin', ['missing-project'])).toEqual(new Map());
    expect(await suspensions.suspensionOf('missing-project')).toBeNull();
  });
});
