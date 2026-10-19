import {
  DemoTrafficInAccountError,
  ProjectNotFoundError,
} from '../../domain/errors/project.errors';
import { InMemoryDemoTrafficRepository } from '../../test-utils/in-memory-demo-traffic.repository';
import { SetDemoTrafficUseCase } from './set-demo-traffic.usecase';

const OPERATOR_PROJECT = '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c01';
const CUSTOMER_PROJECT = '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c02';

function setup() {
  const projects = new InMemoryDemoTrafficRepository();
  projects.add({ projectId: OPERATOR_PROJECT, projectName: 'Demo store', accountId: null });
  projects.add({
    projectId: CUSTOMER_PROJECT,
    projectName: 'Shop',
    accountId: 'acc00000-0000-4000-a000-000000000001',
    demoTraffic: true,
  });
  return { projects, setDemoTraffic: new SetDemoTrafficUseCase(projects) };
}

describe('SetDemoTrafficUseCase', () => {
  it('marks a project of the operator for invented visits, and unmarks it', async () => {
    const { setDemoTraffic, projects } = setup();

    const marked = await setDemoTraffic.execute({ projectId: OPERATOR_PROJECT, demoTraffic: true });

    expect(marked).toEqual({
      projectId: OPERATOR_PROJECT,
      projectName: 'Demo store',
      accountId: null,
      demoTraffic: true,
    });
    expect((await projects.targets()).map((target) => target.projectId)).toContain(
      OPERATOR_PROJECT,
    );
    expect(
      (await setDemoTraffic.execute({ projectId: OPERATOR_PROJECT, demoTraffic: false }))
        .demoTraffic,
    ).toBe(false);
  });

  it('refuses invented visits in a project of an account, but always lets them stop', async () => {
    const { setDemoTraffic } = setup();

    await expect(
      setDemoTraffic.execute({ projectId: CUSTOMER_PROJECT, demoTraffic: true }),
    ).rejects.toBeInstanceOf(DemoTrafficInAccountError);
    expect(
      (await setDemoTraffic.execute({ projectId: CUSTOMER_PROJECT, demoTraffic: false }))
        .demoTraffic,
    ).toBe(false);
  });

  it('refuses a project that does not exist, or that is gone before it is marked', async () => {
    const { setDemoTraffic, projects } = setup();

    await expect(
      setDemoTraffic.execute({
        projectId: '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c99',
        demoTraffic: true,
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);

    jest.spyOn(projects, 'mark').mockResolvedValue(null);

    await expect(
      setDemoTraffic.execute({ projectId: OPERATOR_PROJECT, demoTraffic: true }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('InMemoryDemoTrafficRepository', () => {
  it('lists only the marked projects, with their time zone and latest event', async () => {
    const projects = new InMemoryDemoTrafficRepository();
    const lastEventAt = new Date('2026-10-19T05:00:00.000Z');
    projects.add({
      projectId: OPERATOR_PROJECT,
      projectName: 'Demo store',
      accountId: null,
      demoTraffic: true,
      timezone: 'America/New_York',
      lastEventAt,
    });
    projects.add({ projectId: CUSTOMER_PROJECT, projectName: 'Shop', accountId: null });

    expect(await projects.targets()).toEqual([
      { projectId: OPERATOR_PROJECT, timezone: 'America/New_York', lastEventAt },
    ]);
    expect(await projects.mark('5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c99', true)).toBeNull();
    expect(await projects.projectOf('5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c99')).toBeNull();
  });
});
