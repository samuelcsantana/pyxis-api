import type { AccountStatus } from '../../domain/accounts/account-status';
import { SubscriptionRequiredError } from '../../domain/errors/account.errors';
import {
  GoalLimitReachedError,
  GoalNotFoundError,
  InvalidGoalError,
} from '../../domain/errors/goal.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { MAX_GOALS } from '../../domain/goals/goal';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { goalIdOf, InMemoryGoalRepository } from '../../test-utils/in-memory-goal.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { CreateGoalUseCase } from './create-goal.usecase';
import { DeleteGoalUseCase } from './delete-goal.usecase';
import { UpdateGoalUseCase } from './update-goal.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const STRANGER_ID = 'ad000000-0000-4000-a000-000000000002';
const SIGNUP = { type: 'event', name: 'signup_completed' } as const;
const THANKS = { type: 'page', path: '/thanks/*' } as const;

async function setup(status: AccountStatus = 'active') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const { projectId } = await new CreateProjectUseCase(store, random, accounts).execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    accountId: account.id,
  });
  const goals = new InMemoryGoalRepository();
  return {
    projectId,
    goals,
    createGoal: new CreateGoalUseCase(store, accounts, goals),
    updateGoal: new UpdateGoalUseCase(store, accounts, goals),
    deleteGoal: new DeleteGoalUseCase(store, accounts, goals),
  };
}

describe('CreateGoalUseCase', () => {
  it('adds goals after the last one, with the name trimmed', async () => {
    const { createGoal, projectId } = await setup();

    const first = await createGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: '  Signed up ',
      target: SIGNUP,
    });
    const second = await createGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Saw the thanks page',
      target: THANKS,
    });

    expect(first).toMatchObject({ name: 'Signed up', target: SIGNUP, position: 1 });
    expect(second).toMatchObject({ target: THANKS, position: 2 });
  });

  it(`refuses an eleventh goal with goal_limit_reached`, async () => {
    const { createGoal, projectId } = await setup();
    for (let index = 0; index < MAX_GOALS; index += 1) {
      await createGoal.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: `Goal ${String(index)}`,
        target: SIGNUP,
      });
    }

    await expect(
      createGoal.execute({ adminUserId: OWNER_ID, projectId, name: 'One more', target: SIGNUP }),
    ).rejects.toBeInstanceOf(GoalLimitReachedError);
  });

  it.each([
    ['an empty name', '  ', SIGNUP],
    ['a name too long', 'x'.repeat(65), SIGNUP],
    ['an event name with capitals', 'Signed up', { type: 'event', name: 'SignUp' } as const],
    ['a page path without its slash', 'Thanks', { type: 'page', path: 'thanks' } as const],
    ['a page path too long', 'Thanks', { type: 'page', path: `/${'x'.repeat(256)}` } as const],
  ])('refuses %s before touching the store', async (_case, name, target) => {
    const { createGoal, goals, projectId } = await setup();

    await expect(
      createGoal.execute({ adminUserId: OWNER_ID, projectId, name, target }),
    ).rejects.toBeInstanceOf(InvalidGoalError);
    expect(goals.stored).toEqual([]);
  });

  it('answers not found to someone who does not own the project', async () => {
    const { createGoal, projectId } = await setup();

    await expect(
      createGoal.execute({
        adminUserId: STRANGER_ID,
        projectId,
        name: 'Signed up',
        target: SIGNUP,
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('needs an account with access to its plan', async () => {
    const { createGoal, projectId } = await setup('ended');

    await expect(
      createGoal.execute({ adminUserId: OWNER_ID, projectId, name: 'Signed up', target: SIGNUP }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });
});

describe('UpdateGoalUseCase', () => {
  async function withGoal() {
    const context = await setup();
    const goal = await context.createGoal.execute({
      adminUserId: OWNER_ID,
      projectId: context.projectId,
      name: 'Signed up',
      target: SIGNUP,
    });
    return { ...context, goal };
  }

  it('renames a goal and keeps what reaches it', async () => {
    const { updateGoal, projectId, goal } = await withGoal();

    const updated = await updateGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      goalId: goal.id,
      name: ' Account created ',
    });

    expect(updated).toMatchObject({ name: 'Account created', target: SIGNUP, position: 1 });
  });

  it('changes what reaches a goal and keeps its name, the other goals untouched', async () => {
    const { createGoal, updateGoal, goals, projectId, goal } = await withGoal();
    const other = await createGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Bought',
      target: { type: 'event', name: 'purchase' },
    });

    const updated = await updateGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      goalId: goal.id,
      target: THANKS,
    });

    expect(updated).toMatchObject({ name: 'Signed up', target: THANKS });
    expect(goals.stored).toContainEqual(other);
  });

  it('answers goal_not_found for an id that is not a goal of the project', async () => {
    const { updateGoal, goals, projectId, goal } = await withGoal();
    await goals.create('another-project', { name: 'Other', target: SIGNUP }, MAX_GOALS);

    await expect(
      updateGoal.execute({ adminUserId: OWNER_ID, projectId, goalId: goalIdOf(2), name: 'X' }),
    ).rejects.toBeInstanceOf(GoalNotFoundError);
    expect(goals.stored.find(({ id }) => id === goal.id)?.name).toBe('Signed up');
  });

  it('refuses an invalid change', async () => {
    const { updateGoal, projectId, goal } = await withGoal();

    await expect(
      updateGoal.execute({ adminUserId: OWNER_ID, projectId, goalId: goal.id, name: '' }),
    ).rejects.toBeInstanceOf(InvalidGoalError);
  });

  it('answers not found to someone who does not own the project', async () => {
    const { updateGoal, projectId, goal } = await withGoal();

    await expect(
      updateGoal.execute({ adminUserId: STRANGER_ID, projectId, goalId: goal.id, name: 'X' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('DeleteGoalUseCase', () => {
  it('deletes a goal of the project and leaves the others', async () => {
    const { createGoal, deleteGoal, goals, projectId } = await setup();
    const first = await createGoal.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Signed up',
      target: SIGNUP,
    });
    await createGoal.execute({ adminUserId: OWNER_ID, projectId, name: 'Thanks', target: THANKS });

    await deleteGoal.execute({ adminUserId: OWNER_ID, projectId, goalId: first.id });

    expect((await goals.listByProject(projectId)).map(({ name }) => name)).toEqual(['Thanks']);
  });

  it('answers goal_not_found for a goal of another project', async () => {
    const { deleteGoal, goals, projectId } = await setup();
    const other = await goals.create('another-project', { name: 'Other', target: SIGNUP }, 1);
    const otherId = other.outcome === 'created' ? other.goal.id : '';

    await expect(
      deleteGoal.execute({ adminUserId: OWNER_ID, projectId, goalId: otherId }),
    ).rejects.toBeInstanceOf(GoalNotFoundError);
    expect(goals.stored).toHaveLength(1);
  });

  it('answers not found to someone who does not own the project', async () => {
    const { deleteGoal, projectId } = await setup();

    await expect(
      deleteGoal.execute({ adminUserId: STRANGER_ID, projectId, goalId: goalIdOf(1) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
